"""Base reutilizável para módulos de registos de negócio (lista, ficha, edição com
controlo de versão, lixeira, histórico, auditoria e permissões por registo)."""

from django.db import transaction
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import OPERACAO_POR_ACAO, PermissaoModulo, ambito_efetivo, filtrar, pode_no_registo
from apps.core.auditoria import registar

CAMPOS_IGNORADOS_HISTORICO = {"versao", "atualizado_em", "atualizado_por"}


class RegistoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    modulo: str
    modelo = None
    nome_registo = "registo"  # usado nas mensagens ("Este imóvel foi alterado…")
    campos_auditados: list[str] = []
    permission_classes = [PermissaoModulo]
    operacoes_extra = {
        "restaurar": Operacao.RESTAURAR,
        "lixeira": Operacao.RESTAURAR,
        "historico": Operacao.CONSULTAR,
        "opcoes": Operacao.CONSULTAR,
    }

    # Subclasses: base_queryset() e filtros(qs)
    def base_queryset(self):
        return self.modelo.objects.all()

    def filtros(self, qs):
        return qs

    def operacao_atual(self):
        return self.operacoes_extra.get(self.action) or OPERACAO_POR_ACAO.get(self.action, Operacao.CONSULTAR)

    def get_queryset(self):
        qs = self.base_queryset()
        qs = qs.na_lixeira() if self.action in ("lixeira", "restaurar") else qs.ativos()
        qs = filtrar(self.request.user, self.modulo, self.operacao_atual(), qs, campo_partilhas="partilhada_com")
        return self.filtros(qs) if self.action == "list" else qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["acoes"] = AcoesPorRegisto(self.request.user, self.modulo, self.modelo)
        return ctx

    def recarregar(self, obj):
        return self.base_queryset().get(pk=obj.pk)

    def _fotografia(self, obj):
        return {c: None if getattr(obj, c) is None else str(getattr(obj, c)) for c in self.campos_auditados}

    def validar_responsavel(self, novo, atual=None):
        """Atribuir a outro utilizador é uma transferência: exige permissão e âmbito."""
        u = self.request.user
        if novo is None or novo == (atual or u):
            return
        ambito = ambito_efetivo(u, self.modulo, Operacao.TRANSFERIR)
        permitido = ambito == Ambito.TODOS or (
            ambito == Ambito.EQUIPA and u.equipa_id and novo.equipa_id == u.equipa_id
        )
        if not permitido:
            raise PermissionDenied(f"Não tem permissão para atribuir este {self.nome_registo} a outro utilizador.")

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        self.validar_responsavel(s.validated_data.get("responsavel"))
        obj = s.save(
            responsavel=s.validated_data.get("responsavel") or request.user,
            criado_por=request.user,
            atualizado_por=request.user,
        )
        registar(f"{self.nome_registo}.criado", modulo=self.modulo, objeto=obj, request=request)
        return Response(self.get_serializer(self.recarregar(obj)).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        with transaction.atomic():
            obj = self.get_object()
            obj = type(obj).objects.select_for_update().get(pk=obj.pk)
            versao = request.data.get("versao")
            if versao is None:
                raise serializers.ValidationError({"versao": "Campo obrigatório."})
            if int(versao) != obj.versao:
                return Response(
                    {
                        "detail": f"Este {self.nome_registo} foi alterado por outra pessoa entretanto. "
                        "Recarregue a ficha antes de gravar.",
                        "codigo": "conflito_versao",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            s = self.get_serializer(obj, data=request.data, partial=parcial)
            s.is_valid(raise_exception=True)
            responsavel_antes = obj.responsavel
            self.validar_responsavel(s.validated_data.get("responsavel"), atual=responsavel_antes)
            antes = self._fotografia(obj)
            obj = s.save(atualizado_por=request.user)
            depois = self._fotografia(obj)
            alteracoes = {c: [antes[c], depois[c]] for c in self.campos_auditados if antes[c] != depois[c]}
            registar(f"{self.nome_registo}.alterado", modulo=self.modulo, objeto=obj, request=request, dados=alteracoes)
            if obj.responsavel != responsavel_antes:
                registar(
                    f"{self.nome_registo}.transferido",
                    modulo=self.modulo,
                    objeto=obj,
                    request=request,
                    dados={"de": responsavel_antes.pk, "para": obj.responsavel.pk},
                )
        return Response(self.get_serializer(self.recarregar(obj)).data)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.enviar_para_lixeira(request.user)
        registar(f"{self.nome_registo}.lixeira", modulo=self.modulo, objeto=obj, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def lixeira(self, request):
        return super().list(request)

    @action(detail=True, methods=["post"])
    def restaurar(self, request, pk=None):
        obj = self.get_object()
        obj.restaurar(request.user)
        registar(f"{self.nome_registo}.restaurado", modulo=self.modulo, objeto=obj, request=request)
        return Response(self.get_serializer(self.recarregar(obj)).data)

    @action(detail=True, methods=["get"])
    def historico(self, request, pk=None):
        obj = self.get_object()
        resultado = []
        for h in obj.historico.select_related("history_user").order_by("-history_date")[:100]:
            alteracoes = []
            if h.prev_record:
                alteracoes = [
                    {
                        "campo": c.field,
                        "antes": valor_legivel(self.modelo, c.field, c.old),
                        "depois": valor_legivel(self.modelo, c.field, c.new),
                    }
                    for c in h.diff_against(h.prev_record).changes
                    if c.field not in CAMPOS_IGNORADOS_HISTORICO
                ]
            resultado.append(
                {
                    "momento": h.history_date,
                    "tipo": {"+": "criação", "~": "alteração", "-": "eliminação"}[h.history_type],
                    "utilizador": h.history_user.nome if h.history_user else None,
                    "alteracoes": alteracoes,
                }
            )
        return Response(resultado)

    def permissoes_gerais(self, request) -> dict:
        u = request.user
        return {
            "pode_criar": ambito_efetivo(u, self.modulo, Operacao.CRIAR) != Ambito.NENHUM,
            "pode_transferir": ambito_efetivo(u, self.modulo, Operacao.TRANSFERIR) != Ambito.NENHUM,
            "pode_restaurar": ambito_efetivo(u, self.modulo, Operacao.RESTAURAR) != Ambito.NENHUM,
        }


def _texto(v):
    return None if v is None else str(v)


def valor_legivel(modelo, campo: str, valor):
    """Para campos de relação, mostra o nome do registo em vez do identificador."""
    if valor is None:
        return None
    try:
        f = modelo._meta.get_field(campo)
    except Exception:  # noqa: BLE001
        return str(valor)
    if f.is_relation and f.related_model is not None:
        rel = f.related_model._default_manager.filter(pk=valor).first()
        return str(rel) if rel is not None else str(valor)
    if getattr(f, "choices", None):
        return dict(f.choices).get(valor, str(valor))
    if isinstance(valor, bool):
        return "Sim" if valor else "Não"
    return str(valor)


class AcoesPorRegisto(dict):
    """Ações permitidas por registo, calculadas no servidor (a interface só as reflete)."""

    def __init__(self, utilizador, modulo, modelo):
        super().__init__()
        self.u, self.modulo, self.modelo = utilizador, modulo, modelo

    def get(self, pk, default=None):
        if pk not in self:
            obj = self.modelo.objects.get(pk=pk)
            kw = {"campo_partilhas": "partilhada_com"}
            self[pk] = {
                op: pode_no_registo(self.u, self.modulo, op, obj, **kw)
                for op in (Operacao.EDITAR, Operacao.ELIMINAR, Operacao.TRANSFERIR)
            }
        return super().get(pk, default)
