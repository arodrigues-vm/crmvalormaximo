from django.contrib.postgres.lookups import Unaccent  # noqa: F401  (regista o lookup)
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import PermissaoModulo, ambito_efetivo, filtrar, pode_no_registo
from apps.core.auditoria import registar
from apps.core.validacao import normalizar_telefone

from .models import Entidade, OrigemContacto, PapelEntidade, TelefoneEntidade
from .serializers import (
    DuplicadosPedidoSerializer,
    EntidadeListaSerializer,
    EntidadeSerializer,
)
from .servicos import existem_outros_fortes, procurar_duplicados, tem_duplicado_forte

MODULO = "entidades"
ORDENACOES = {
    "nome": "nome_completo",
    "-nome": "-nome_completo",
    "recentes": "-criado_em",
    "referencia": "id",
}
CAMPOS_AUDITADOS = [
    "tipo_pessoa", "nome", "apelido", "pais_fiscal", "nif", "data_nascimento", "email", "rua", "numero_policia",
    "complemento", "codigo_postal", "localidade", "freguesia_id", "origem_id", "responsavel_id", "ativa",
    "observacoes", "consentimento_marketing", "consentimento_marketing_em", "oposicao_marketing",
]  # fmt: skip


class ConflitoVersao(Exception):
    pass


def _fotografia(e: Entidade) -> dict:
    return {c: str(getattr(e, c)) if getattr(e, c) is not None else None for c in CAMPOS_AUDITADOS}


class EntidadeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    modulo = MODULO
    permission_classes = [PermissaoModulo]
    operacoes_extra = {
        "restaurar": Operacao.RESTAURAR,
        "lixeira": Operacao.RESTAURAR,
        "duplicados": Operacao.CONSULTAR,
        "historico": Operacao.CONSULTAR,
        "opcoes": Operacao.CONSULTAR,
    }

    def get_serializer_class(self):
        return EntidadeListaSerializer if self.action == "list" else EntidadeSerializer

    def _operacao(self):
        from apps.contas.permissoes import OPERACAO_POR_ACAO

        return self.operacoes_extra.get(self.action) or OPERACAO_POR_ACAO.get(self.action, Operacao.CONSULTAR)

    def get_queryset(self):
        qs = Entidade.objects.select_related("responsavel", "origem", "freguesia__concelho__distrito")
        qs = qs.prefetch_related(
            "papeis", Prefetch("telefones", queryset=TelefoneEntidade.objects.order_by("-principal", "ordem"))
        )
        qs = qs.na_lixeira() if self.action in ("lixeira", "restaurar") else qs.ativos()
        qs = filtrar(self.request.user, MODULO, self._operacao(), qs, campo_partilhas="partilhada_com")
        if self.action == "list":
            qs = self._filtros(qs)
        return qs

    def _filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            digitos = "".join(c for c in termo if c.isdigit())
            cond = Q(nome_completo__unaccent__icontains=termo) | Q(email__icontains=termo)
            cond |= Q(referencia__iexact=termo)
            if len(digitos) >= 3:
                cond |= Q(nif__startswith=digitos) | Q(telefones__numero_e164__contains=digitos)
            qs = qs.filter(cond).distinct()
        if p.get("papel"):
            qs = qs.filter(papeis__id=p["papel"])
        if p.get("tipo_pessoa"):
            qs = qs.filter(tipo_pessoa=p["tipo_pessoa"])
        if p.get("ativa") in ("true", "false"):
            qs = qs.filter(ativa=p["ativa"] == "true")
        if p.get("responsavel"):
            qs = qs.filter(responsavel_id=p["responsavel"])
        return qs.order_by(ORDENACOES.get(p.get("ordenar", "nome"), "nome_completo"), "id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action in ("retrieve", "update", "partial_update", "create"):
            ctx["acoes"] = _AcoesCalculadas(self.request.user)
        return ctx

    @extend_schema(
        parameters=[
            OpenApiParameter("pesquisa", str),
            OpenApiParameter("papel", int),
            OpenApiParameter("tipo_pessoa", str),
            OpenApiParameter("ativa", bool),
            OpenApiParameter("responsavel", int),
            OpenApiParameter("ordenar", str, enum=list(ORDENACOES)),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    # Criação / edição -----------------------------------------------------------

    def _validar_responsavel(self, novo, atual=None):
        """Atribuir a outro utilizador é uma transferência: exige permissão e âmbito."""
        u = self.request.user
        if novo is None or novo == (atual or u):
            return
        ambito = ambito_efetivo(u, MODULO, Operacao.TRANSFERIR)
        permitido = ambito == Ambito.TODOS or (
            ambito == Ambito.EQUIPA and u.equipa_id and novo.equipa_id == u.equipa_id
        )
        if not permitido:
            raise PermissionDenied("Não tem permissão para atribuir esta entidade a outro utilizador.")

    def _verificar_duplicados(self, dados, excluir_id=None):
        if dados.get("confirmar_duplicado"):
            return
        telefones = [t["numero_e164"] for t in dados.get("telefones") or []]
        candidatos, _ = procurar_duplicados(
            self.request.user,
            nif=dados.get("nif", ""),
            email=dados.get("email", ""),
            telefones=telefones,
            excluir_id=excluir_id,
        )
        outros = existem_outros_fortes(
            self.request.user,
            [c["id"] for c in candidatos],
            nif=dados.get("nif", ""),
            email=dados.get("email", ""),
            telefones=telefones,
            excluir_id=excluir_id,
        )
        if tem_duplicado_forte(candidatos, outros):
            raise _Duplicado(candidatos, outros)

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        self._validar_responsavel(s.validated_data.get("responsavel"))
        try:
            self._verificar_duplicados(s.validated_data)
        except _Duplicado as d:
            return d.resposta()
        e = s.save(
            responsavel=s.validated_data.get("responsavel") or request.user,
            criado_por=request.user,
            atualizado_por=request.user,
        )
        registar("entidade.criada", modulo=MODULO, objeto=e, request=request, descricao=e.nome_completo)
        if s.validated_data.get("confirmar_duplicado"):
            registar("entidade.duplicado_confirmado", modulo=MODULO, objeto=e, request=request)
        return Response(self.get_serializer(self._recarregar(e)).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        with transaction.atomic():
            e = self.get_object()
            e = Entidade.objects.select_for_update().get(pk=e.pk)
            versao = request.data.get("versao")
            if versao is None:
                raise serializers.ValidationError({"versao": "Campo obrigatório."})
            if int(versao) != e.versao:
                return Response(
                    {
                        "detail": "Esta entidade foi alterada por outra pessoa entretanto. "
                        "Recarregue a ficha antes de gravar.",
                        "codigo": "conflito_versao",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            s = self.get_serializer(e, data=request.data, partial=parcial)
            s.is_valid(raise_exception=True)
            responsavel_antes = e.responsavel
            self._validar_responsavel(s.validated_data.get("responsavel"), atual=responsavel_antes)
            alterou_contactos = any(k in s.validated_data for k in ("nif", "email", "telefones"))
            if alterou_contactos:
                try:
                    self._verificar_duplicados(s.validated_data, excluir_id=e.pk)
                except _Duplicado as d:
                    return d.resposta()
            antes = _fotografia(e)
            e = s.save(atualizado_por=request.user)
            depois = _fotografia(e)
            alteracoes = {c: [antes[c], depois[c]] for c in CAMPOS_AUDITADOS if antes[c] != depois[c]}
            registar("entidade.alterada", modulo=MODULO, objeto=e, request=request, dados=alteracoes)
            if e.responsavel != responsavel_antes:
                registar(
                    "entidade.transferida",
                    modulo=MODULO,
                    objeto=e,
                    request=request,
                    dados={"de": responsavel_antes.pk, "para": e.responsavel.pk},
                )
        return Response(self.get_serializer(self._recarregar(e)).data)

    def _recarregar(self, e):
        return (
            Entidade.objects.select_related("responsavel", "origem", "freguesia__concelho__distrito")
            .prefetch_related("papeis", "telefones")
            .get(pk=e.pk)
        )

    # Lixeira ------------------------------------------------------------------

    def destroy(self, request, *args, **kwargs):
        e = self.get_object()
        e.enviar_para_lixeira(request.user)
        registar("entidade.lixeira", modulo=MODULO, objeto=e, request=request, descricao=e.nome_completo)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def lixeira(self, request):
        return super().list(request)

    @action(detail=True, methods=["post"])
    def restaurar(self, request, pk=None):
        e = self.get_object()
        e.restaurar(request.user)
        registar("entidade.restaurada", modulo=MODULO, objeto=e, request=request)
        return Response(self.get_serializer(self._recarregar(e)).data)

    # Apoio --------------------------------------------------------------------

    @extend_schema(request=DuplicadosPedidoSerializer)
    @action(detail=False, methods=["post"])
    def duplicados(self, request):
        """Verificação prévia de duplicados (usada enquanto se preenche o formulário)."""
        s = DuplicadosPedidoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        telefones = []
        for t in d.get("telefones", []):
            try:
                telefones.append(normalizar_telefone(t.get("regiao", "PT"), str(t.get("numero", ""))))
            except DjangoValidationError:
                pass
        candidatos, outros = procurar_duplicados(
            request.user,
            nif=d.get("nif", ""),
            email=d.get("email", ""),
            telefones=telefones,
            nome=d.get("nome", ""),
            excluir_id=d.get("excluir_id"),
        )
        return Response({"candidatos": candidatos, "outros": outros})

    @action(detail=True, methods=["get"])
    def historico(self, request, pk=None):
        e = self.get_object()
        registos = e.historico.select_related("history_user").order_by("-history_date")[:100]
        resultado = []
        for h in registos:
            alteracoes = []
            if h.prev_record:
                delta = h.diff_against(h.prev_record)
                alteracoes = [
                    {"campo": c.field, "antes": _texto(c.old), "depois": _texto(c.new)}
                    for c in delta.changes
                    if c.field not in ("versao", "atualizado_em", "atualizado_por")
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

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        """Listas de valores para os formulários."""
        return Response(
            {
                "papeis": list(PapelEntidade.objects.filter(ativo=True).values("id", "nome")),
                "origens": list(OrigemContacto.objects.filter(ativa=True).values("id", "nome")),
                "tipos_pessoa": [{"valor": v, "nome": n} for v, n in Entidade.TipoPessoa.choices],
                "consentimentos": [{"valor": v, "nome": n} for v, n in Entidade.Consentimento.choices],
                "tipos_telefone": [{"valor": v, "nome": n} for v, n in TelefoneEntidade.Tipo.choices],
                "pode_criar": PermissaoModulo().has_permission(request, _Vista("create")),
                "pode_transferir": ambito_efetivo(request.user, MODULO, Operacao.TRANSFERIR) != Ambito.NENHUM,
                "pode_restaurar": ambito_efetivo(request.user, MODULO, Operacao.RESTAURAR) != Ambito.NENHUM,
            }
        )


def _texto(v):
    return None if v is None else str(v)


class _Vista:
    modulo = MODULO

    def __init__(self, acao):
        self.action = acao


class _AcoesCalculadas(dict):
    """Ações permitidas por registo, calculadas no servidor (a interface só as reflete)."""

    def __init__(self, utilizador):
        super().__init__()
        self.u = utilizador

    def get(self, pk, default=None):
        if pk not in self:
            e = Entidade.objects.get(pk=pk)
            kw = {"campo_partilhas": "partilhada_com"}
            self[pk] = {
                "editar": pode_no_registo(self.u, MODULO, Operacao.EDITAR, e, **kw),
                "eliminar": pode_no_registo(self.u, MODULO, Operacao.ELIMINAR, e, **kw),
                "transferir": pode_no_registo(self.u, MODULO, Operacao.TRANSFERIR, e, **kw),
            }
        return super().get(pk, default)


class _Duplicado(Exception):
    def __init__(self, candidatos, outros):
        self.candidatos, self.outros = candidatos, outros

    def resposta(self):
        return Response(
            {
                "detail": "Já existe uma entidade com o mesmo NIF, email ou telefone.",
                "codigo": "possivel_duplicado",
                "candidatos": self.candidatos,
                "outros": self.outros,
            },
            status=status.HTTP_409_CONFLICT,
        )
