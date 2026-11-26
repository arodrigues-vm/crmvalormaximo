from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar, pode
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis
from apps.transacoes.models import Transacao

from .models import ModeloTarefa, Tarefa
from .serializers import CriarDeModelosSerializer, ModeloTarefaSerializer, TarefaListaSerializer, TarefaSerializer
from .servicos import MODULO, criar_de_modelo, modelos_por_usar


def transacoes_visiveis(utilizador) -> set[int]:
    qs = filtrar(
        utilizador, "transacoes", Operacao.CONSULTAR, Transacao.objects.ativos(), campo_partilhas="partilhada_com"
    )
    return set(qs.values_list("pk", flat=True))


class TarefaViewSet(RegistoViewSet):
    """Tarefas de pós-venda (F3-09, D-50)."""

    modulo = MODULO
    ecra = "tarefas"
    modelo = Tarefa
    nome_registo = "tarefa"
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "proposta": Operacao.CONSULTAR,
        "criar_de_modelos": Operacao.CRIAR,
    }
    campos_auditados = [
        "titulo", "descricao", "categoria_id", "estado_id", "prioridade_id", "prazo", "transacao_id", "responsavel_id",
    ]  # fmt: skip

    def get_serializer_class(self):
        return TarefaListaSerializer if self.action == "list" else TarefaSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        ctx["transacoes_visiveis"] = transacoes_visiveis(self.request.user)
        return ctx

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
        vista = p.get("vista") or "abertas"
        abertas = Q(estado__categoria__in=("aberta", "em_curso")) | Q(estado__isnull=True)
        if vista == "abertas":
            qs = qs.filter(abertas)
        elif vista == "atrasadas":
            qs = qs.filter(abertas, prazo__lt=timezone.localdate())
        elif vista == "concluidas":
            qs = qs.filter(estado__categoria="concluida")
        if p.get("transacao"):
            qs = qs.filter(transacao_id=p["transacao"])
        if p.get("responsavel"):
            qs = qs.filter(responsavel_id=p["responsavel"])
        return qs.order_by("prazo", "id")

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in ("pesquisa", "vista", "transacao", "responsavel")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "estados": opcoes_lista("estados_tarefa"),
                "prioridades": opcoes_lista("prioridades"),
                "categorias": opcoes_lista("categorias_tarefa"),
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                **self.permissoes_gerais(request),
            }
        )

    def _transacao(self, pk):
        t = Transacao.objects.ativos().filter(pk=pk).first()
        if t is None or t.pk not in transacoes_visiveis(self.request.user):
            raise serializers.ValidationError({"transacao": "Transação inexistente ou sem acesso."})
        if not t.estado or t.estado.categoria != "concluida":
            raise serializers.ValidationError({"transacao": "As tarefas de pós-venda são de transações concluídas."})
        return t

    @extend_schema(parameters=[OpenApiParameter("transacao", int, required=True)])
    @action(detail=False, methods=["get"])
    def proposta(self, request):
        """Modelos de pós-venda ainda não usados nesta transação (nada é criado)."""
        t = self._transacao(request.query_params.get("transacao"))
        return Response(
            [
                {"id": m.pk, "nome": m.nome, "descricao": m.descricao, "dias_apos": m.dias_apos}
                for m in modelos_por_usar(t)
            ]
        )

    @extend_schema(request=CriarDeModelosSerializer)
    @action(detail=False, methods=["post"], url_path="criar-de-modelos")
    def criar_de_modelos(self, request):
        """Cria as tarefas dos modelos confirmados pelo utilizador (sem duplicar modelos já usados)."""
        s = CriarDeModelosSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            t = Transacao.objects.select_for_update().get(pk=self._transacao(s.validated_data["transacao"].pk).pk)
            livres = {m.pk for m in modelos_por_usar(t)}
            criadas = [
                criar_de_modelo(t, m, request.user, t.data_escritura, request=request)
                for m in s.validated_data["modelos"]
                if m.pk in livres
            ]
        return Response(TarefaListaSerializer(criadas, many=True, context=self.get_serializer_context()).data,
                        status=status.HTTP_201_CREATED)  # fmt: skip


class ModeloTarefaViewSet(viewsets.ModelViewSet):
    """Modelos de tarefa de pós-venda (Configurações). Todos consultam; só o Administrador altera.
    Não se apagam: desativam-se (as tarefas já criadas mantêm-se)."""

    serializer_class = ModeloTarefaSerializer
    permission_classes = [IsAuthenticated]
    queryset = ModeloTarefa.objects.order_by("ordem", "id")
    pagination_class = None
    http_method_names = ["get", "post", "patch"]

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
