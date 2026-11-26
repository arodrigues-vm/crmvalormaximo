from django.db import transaction
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
from apps.entidades.models import Entidade
from apps.imoveis.views import entidades_visiveis

from .models import Inscricao, PlanoEntidades
from .serializers import InscricaoSerializer, PlanoEntidadesSerializer, TerminarSerializer
from .servicos import (
    MODULO,
    NOMES_CRITERIOS,
    filtro_rgpd,
    impedimento_rgpd,
    inscrever,
    publico,
    resumo_publico,
    terminar,
)


class PlanoEntidadesViewSet(viewsets.ModelViewSet):
    """Configuração dos planos (Configurações → Marketing de Entidades). Consultam os utilizadores do módulo;
    só o Administrador cria e altera. Não se apagam: desativam-se."""

    serializer_class = PlanoEntidadesSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ["get", "post", "patch"]

    def get_queryset(self):
        if not (pode(self.request.user, MODULO, Operacao.CONSULTAR)
                or pode(self.request.user, "configuracoes", Operacao.ADMINISTRAR)):  # fmt: skip
            raise PermissionDenied()
        return PlanoEntidades.objects.prefetch_related("passos__responsavel").order_by("ordem", "id")

    def _exigir_admin(self):
        if not pode(self.request.user, "configuracoes", Operacao.ADMINISTRAR):
            raise PermissionDenied("Só o Administrador configura os planos de marketing de entidades.")

    def perform_create(self, s):
        self._exigir_admin()
        p = s.save()
        registar("plano_entidades.criado", modulo="configuracoes", objeto=p, request=self.request, dados=s.data)

    def perform_update(self, s):
        self._exigir_admin()
        antes = PlanoEntidadesSerializer(s.instance).data
        p = s.save()
        registar("plano_entidades.alterado", modulo="configuracoes", objeto=p, request=self.request,
                 dados={"antes": antes, "depois": PlanoEntidadesSerializer(p).data})  # fmt: skip

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response({
            "fundamentos": [{"valor": k, "nome": n} for k, n in PlanoEntidades.Fundamento.choices],
            "gatilhos": [{"valor": k, "nome": n} for k, n in PlanoEntidades.GATILHOS],
            "criterios": [{"valor": k, "nome": n} for k, n in NOMES_CRITERIOS.items()],
            "papeis": opcoes_lista("papeis_entidade"),
            "status": opcoes_lista("status_entidade"),
            "origens": opcoes_lista("origens_contacto"),
            "zonas": opcoes_lista("zonas_comerciais"),
            "pode_configurar": pode(request.user, "configuracoes", Operacao.ADMINISTRAR),
        })  # fmt: skip

    @action(detail=True, methods=["get"])
    def publico(self, request, pk=None):
        """Quantas entidades cumprem o público e quantas a regra de RGPD autoriza (pré-visualização)."""
        return Response(resumo_publico(self.get_object()))

    @action(detail=True, methods=["post"], url_path="iniciar-publico")
    def iniciar_publico(self, request, pk=None):
        """Inscreve no plano as entidades do público, autorizadas pelo RGPD e visíveis para quem inicia, que ainda
        não estejam inscritas. Ação expressa (o ecrã mostra antes a pré-visualização)."""
        plano = self.get_object()
        if not plano.ativo:
            raise serializers.ValidationError({"detail": "O plano está desativado."})
        if not pode(request.user, MODULO, Operacao.CRIAR):
            raise PermissionDenied()
        visiveis = filtrar(request.user, "entidades", Operacao.CONSULTAR, Entidade.objects.ativos(),
                           campo_partilhas="partilhada_com")  # fmt: skip
        alvo = publico(plano).filter(filtro_rgpd(plano), pk__in=visiveis.values("pk"))
        criadas = [i for e in alvo if (i := inscrever(e, plano, "publico", request.user, request=request))]
        registar("plano_entidades.iniciado_publico", modulo=MODULO, objeto=plano, request=request,
                 dados={"inscritas": len(criadas)})  # fmt: skip
        return Response({"inscritas": len(criadas)}, status=status.HTTP_201_CREATED)


class InscricaoViewSet(RegistoViewSet):
    """Entidades nos planos de marketing (execução)."""

    modulo = MODULO
    ecra = "marketing_entidades"
    modelo = Inscricao
    nome_registo = "inscricao_marketing"
    serializer_class = InscricaoSerializer
    http_method_names = ["get", "post", "delete"]
    operacoes_extra = {**RegistoViewSet.operacoes_extra, "terminar": Operacao.EDITAR}
    campos_auditados = ["estado", "motivo_fim"]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Inscricao.objects.select_related("entidade", "plano", "responsavel").prefetch_related("tarefas__estado")

    def filtros(self, qs):
        p = self.request.query_params
        if p.get("entidade"):
            qs = qs.filter(entidade_id=p["entidade"])
        if p.get("plano"):
            qs = qs.filter(plano_id=p["plano"])
        if p.get("estado") in (Inscricao.Estado.ATIVA, Inscricao.Estado.TERMINADA):
            qs = qs.filter(estado=p["estado"])
        termo = (self.request.query_params.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(entidade__nome_completo__unaccent__icontains=termo)
        return qs.order_by("-inicio", "-id")

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in ("entidade", "plano", "estado", "pesquisa")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """Inscrever à mão (na ficha da entidade). Recusa com o motivo quando o RGPD não o permite."""
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        e, plano = s.validated_data["entidade"], s.validated_data["plano"]
        if e.pk not in entidades_visiveis(request.user):
            raise serializers.ValidationError({"entidade": "Entidade inexistente ou sem acesso."})
        motivo = impedimento_rgpd(e, plano)
        if motivo:
            raise serializers.ValidationError({"plano": motivo})
        ins = inscrever(e, plano, "manual", request.user, request=request)
        if ins is None:
            raise serializers.ValidationError({"plano": "A entidade já está neste plano."})
        return Response(self.get_serializer(self.recarregar(ins)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=TerminarSerializer)
    @action(detail=True, methods=["post"])
    def terminar(self, request, pk=None):
        s = TerminarSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            ins = Inscricao.objects.select_for_update().get(pk=self.get_object().pk)
            if ins.estado != Inscricao.Estado.ATIVA:
                raise serializers.ValidationError({"detail": "A inscrição já está terminada."})
            terminar(ins, s.validated_data["motivo"].strip(), request.user, request=request)
        return Response(self.get_serializer(self.recarregar(ins)).data)

    def destroy(self, request, *args, **kwargs):
        raise serializers.ValidationError({"detail": "As inscrições não se apagam: termine-as (fica o histórico)."})
