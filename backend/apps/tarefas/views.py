from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Operacao
from apps.contas.permissoes import OPERACAO_POR_ACAO, filtrar, pode, pode_no_registo
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis
from apps.transacoes.models import Transacao

from .models import MODULOS_MODELO, ORIGENS, ModeloTarefa, Tarefa
from .serializers import (
    CriarDeModelosSerializer,
    ModeloTarefaSerializer,
    MudarEstadoTarefaSerializer,
    TarefaListaSerializer,
    TarefaSerializer,
)
from .servicos import (
    ABERTAS,
    FECHADAS,
    MODULO,
    MODULO_GERAL,
    criar_de_modelo,
    criar_de_modelo_origem,
    modelos_por_usar,
    modelos_por_usar_origem,
    obter_origem,
    pode_algum,
    visiveis,
)

KANBAN_MAX = 300
KANBAN_DIAS_FECHADAS = 30


def transacoes_visiveis(utilizador) -> set[int]:
    qs = filtrar(
        utilizador, "transacoes", Operacao.CONSULTAR, Transacao.objects.ativos(), campo_partilhas="partilhada_com"
    )
    return set(qs.values_list("pk", flat=True))


class PermissaoTarefas(BasePermission):
    """Tarefas gerais (módulo «tarefas») e de pós-venda (módulo «pos-venda») partilham a mesma API (D-52):
    basta ter a operação num dos dois módulos; cada registo é depois filtrado pelo seu próprio módulo."""

    def has_permission(self, request, view):
        operacao = view.operacoes_extra.get(view.action) or OPERACAO_POR_ACAO.get(view.action)
        return operacao is not None and pode_algum(request.user, operacao)


class AcoesTarefas(dict):
    def __init__(self, utilizador):
        super().__init__()
        self.u = utilizador

    def get(self, pk, default=None):
        if pk not in self:
            t = Tarefa.objects.get(pk=pk)
            kw = {"campo_partilhas": "partilhada_com"}
            self[pk] = {
                op: pode_no_registo(self.u, t.modulo_permissoes, op, t, **kw)
                for op in (Operacao.EDITAR, Operacao.ELIMINAR, Operacao.TRANSFERIR)
            }
        return super().get(pk, default)


class TarefaViewSet(RegistoViewSet):
    """Tarefas gerais (F4-01, D-52) e de pós-venda (F3-09, D-50): um só identificador e um só serviço."""

    modulo = MODULO_GERAL
    ecra = "tarefas"
    modelo = Tarefa
    nome_registo = "tarefa"
    permission_classes = [PermissaoTarefas]
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "proposta": Operacao.CONSULTAR,
        "criar_de_modelos": Operacao.CRIAR,
        "mudar_estado": Operacao.EDITAR,
        "kanban": Operacao.CONSULTAR,
    }
    campos_auditados = [
        "titulo", "descricao", "categoria_id", "prioridade_id", "prazo", "transacao_id", "origem_modulo", "origem_id",
        "responsavel_id",
    ]  # fmt: skip

    def get_serializer_class(self):
        return TarefaListaSerializer if self.action in ("list", "kanban") else TarefaSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["acoes"] = AcoesTarefas(self.request.user)
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        ctx["transacoes_visiveis"] = transacoes_visiveis(self.request.user)
        return ctx

    def get_queryset(self):
        qs = self.base_queryset()
        qs = qs.na_lixeira() if self.action in ("lixeira", "restaurar") else qs.ativos()
        qs = visiveis(self.request.user, self.operacao_atual(), qs)
        return self.filtros(qs) if self.action in ("list", "kanban") else qs

    def base_queryset(self):
        return Tarefa.objects.select_related(
            "estado", "prioridade", "categoria", "responsavel", "modelo", "transacao__entidade",
            "transacao__imovel__tipo", "transacao__imovel__tipologia",
        )  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(titulo__unaccent__icontains=termo)
                | Q(transacao__referencia__iexact=termo)
                | Q(transacao__entidade__nome_completo__unaccent__icontains=termo)
            )
        abertas = Q(estado__categoria__in=ABERTAS) | Q(estado__isnull=True)
        vista = p.get("vista") or ("todas" if self.action == "kanban" else "abertas")
        if vista == "abertas":
            qs = qs.filter(abertas)
        elif vista == "atrasadas":
            qs = qs.filter(abertas, prazo__lt=timezone.localdate())
        elif vista == "concluidas":
            qs = qs.filter(estado__categoria="concluida")
        tipo = p.get("tipo")
        if tipo == "geral":
            qs = qs.filter(transacao__isnull=True)
        elif tipo == "pos_venda":
            qs = qs.filter(transacao__isnull=False)
        if p.get("transacao"):
            qs = qs.filter(transacao_id=p["transacao"])
        if p.get("origem_modulo"):
            qs = qs.filter(origem_modulo=p["origem_modulo"])
            if p.get("origem_id"):
                qs = qs.filter(origem_id=p["origem_id"])
        if p.get("responsavel"):
            qs = qs.filter(responsavel_id=p["responsavel"])
        return qs.order_by("prazo", "id")

    @extend_schema(
        parameters=[
            OpenApiParameter(n, str)
            for n in ("pesquisa", "vista", "tipo", "transacao", "origem_modulo", "origem_id", "responsavel")
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def kanban(self, request):
        """Quadro: todas as abertas e as fechadas nos últimos 30 dias (máximo 300)."""
        desde = timezone.now() - timedelta(days=KANBAN_DIAS_FECHADAS)
        qs = self.get_queryset().filter(
            Q(estado__categoria__in=ABERTAS) | Q(estado__isnull=True) | Q(atualizado_em__gte=desde)
        )[:KANBAN_MAX]
        return Response(TarefaListaSerializer(qs, many=True, context=self.get_serializer_context()).data)

    def create(self, request, *args, **kwargs):
        modulo = MODULO if request.data.get("transacao") else MODULO_GERAL
        if not pode(request.user, modulo, Operacao.CRIAR):
            raise PermissionDenied("Não tem permissão para criar este tipo de tarefa.")
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        u = request.user
        return Response(
            {
                "estados": opcoes_lista("estados_tarefa"),
                "prioridades": opcoes_lista("prioridades"),
                "categorias": opcoes_lista("categorias_tarefa"),
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                "origens": [{"valor": k, "nome": n} for k, n in ORIGENS],
                "modulos_modelo": [{"valor": k, "nome": n} for k, n in MODULOS_MODELO],
                **self.permissoes_gerais(request),
                "pode_criar": pode(u, MODULO_GERAL, Operacao.CRIAR),
                "pode_criar_pos_venda": pode(u, MODULO, Operacao.CRIAR),
            }
        )

    @extend_schema(request=MudarEstadoTarefaSerializer)
    @action(detail=True, methods=["post"], url_path="mudar-estado")
    def mudar_estado(self, request, pk=None):
        """Concluir, pôr em curso, cancelar ou reabrir. Reabrir (de concluída/cancelada) e cancelar exigem motivo."""
        s = MudarEstadoTarefaSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        novo, motivo = s.validated_data["estado"], s.validated_data["motivo"].strip()
        with transaction.atomic():
            t = Tarefa.objects.select_for_update().get(pk=self.get_object().pk)
            if not novo.ativo:
                raise serializers.ValidationError({"estado": "Estado desativado."})
            if t.estado_id == novo.pk:
                raise serializers.ValidationError({"estado": "A tarefa já está neste estado."})
            de = t.estado.categoria if t.estado else "aberta"
            reabrir = de in FECHADAS and novo.categoria in ABERTAS
            if (reabrir or novo.categoria == "cancelada") and not motivo:
                raise serializers.ValidationError({"motivo": "Indique o motivo."})
            antes = t.estado.nome if t.estado else None
            t.estado, t.motivo_estado, t.atualizado_por = novo, motivo, request.user
            t.concluida_em = timezone.now() if novo.categoria == "concluida" else None
            t.save()
            registar("tarefa.estado", modulo=t.modulo_permissoes, objeto=t, request=request,
                     dados={"de": antes, "para": novo.nome, "motivo": motivo})  # fmt: skip
        return Response(TarefaSerializer(self.recarregar(t), context=self.get_serializer_context()).data)

    def _alvo(self, dados):
        """Transação concluída (pós-venda) ou ficha de origem (tarefas gerais), com acesso verificado."""
        if dados.get("transacao"):
            t = Transacao.objects.ativos().filter(pk=dados["transacao"]).first()
            if t is None or t.pk not in transacoes_visiveis(self.request.user):
                raise serializers.ValidationError({"transacao": "Transação inexistente ou sem acesso."})
            if not t.estado or t.estado.categoria != "concluida":
                raise serializers.ValidationError(
                    {"transacao": "As tarefas de pós-venda são de transações concluídas."}
                )
            return "transacao", t
        obj = obter_origem(self.request.user, dados.get("origem_modulo"), dados.get("origem_id"))
        if obj is None:
            raise serializers.ValidationError({"origem_id": "Registo inexistente ou sem acesso."})
        return dados["origem_modulo"], obj

    @extend_schema(
        parameters=[
            OpenApiParameter("transacao", int),
            OpenApiParameter("origem_modulo", str),
            OpenApiParameter("origem_id", int),
        ]
    )
    @action(detail=False, methods=["get"])
    def proposta(self, request):
        """Modelos ainda não usados nesta transação / ficha (nada é criado)."""
        tipo, obj = self._alvo(request.query_params)
        modelos = modelos_por_usar(obj) if tipo == "transacao" else modelos_por_usar_origem(tipo, obj.pk)
        return Response(
            [{"id": m.pk, "nome": m.nome, "descricao": m.descricao, "dias_apos": m.dias_apos} for m in modelos]
        )

    @extend_schema(request=CriarDeModelosSerializer)
    @action(detail=False, methods=["post"], url_path="criar-de-modelos")
    def criar_de_modelos(self, request):
        """Cria as tarefas dos modelos confirmados (sem duplicar modelos já usados)."""
        s = CriarDeModelosSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        dados = {"transacao": d["transacao"].pk} if d.get("transacao") else d
        tipo, obj = self._alvo(dados)
        if not pode(request.user, MODULO if tipo == "transacao" else MODULO_GERAL, Operacao.CRIAR):
            raise PermissionDenied("Não tem permissão para criar estas tarefas.")
        with transaction.atomic():
            if tipo == "transacao":
                t = Transacao.objects.select_for_update().get(pk=obj.pk)
                livres = {m.pk for m in modelos_por_usar(t)}
                criadas = [criar_de_modelo(t, m, request.user, t.data_escritura, request=request)
                           for m in d["modelos"] if m.pk in livres]  # fmt: skip
            else:
                livres = {m.pk for m in modelos_por_usar_origem(tipo, obj.pk)}
                criadas = [criar_de_modelo_origem(tipo, obj, m, request.user, request=request)
                           for m in d["modelos"] if m.pk in livres]  # fmt: skip
        return Response(TarefaListaSerializer(criadas, many=True, context=self.get_serializer_context()).data,
                        status=status.HTTP_201_CREATED)  # fmt: skip


class ModeloTarefaViewSet(viewsets.ModelViewSet):
    """Modelos de tarefa por módulo (Configurações). Todos consultam; só o Administrador altera.
    Não se apagam: desativam-se (as tarefas já criadas mantêm-se)."""

    serializer_class = ModeloTarefaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ["get", "post", "patch"]

    def get_queryset(self):
        qs = ModeloTarefa.objects.order_by("modulo", "ordem", "id")
        modulo = self.request.query_params.get("modulo")
        return qs.filter(modulo=modulo) if modulo in dict(MODULOS_MODELO) else qs

    def _exigir_admin(self):
        if not pode(self.request.user, "configuracoes", Operacao.ADMINISTRAR):
            raise PermissionDenied("Só o Administrador altera os modelos de tarefa.")

    def perform_create(self, s):
        self._exigir_admin()
        m = s.save()
        registar("modelo_tarefa.criado", modulo="configuracoes", objeto=m, request=self.request, dados=s.data)

    def perform_update(self, s):
        self._exigir_admin()
        antes = ModeloTarefaSerializer(s.instance).data
        m = s.save()
        registar("modelo_tarefa.alterado", modulo="configuracoes", objeto=m, request=self.request,
                 dados={"antes": antes, "depois": s.data})  # fmt: skip
