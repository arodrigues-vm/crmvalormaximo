from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.angariacoes.models import Angariacao
from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar, pode_no_registo
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.tarefas.models import Tarefa

from .models import PedidoRecalculo, PlanoMarketing
from .serializers import (
    CriarPlanoSerializer,
    DecidirRecalculoSerializer,
    IncluirSerializer,
    NovoCicloSerializer,
    PedirRecalculoSerializer,
    PlanoListaSerializer,
    PlanoSerializer,
)
from .servicos import (
    ORIGENS_CICLO,
    aplicar_recalculo,
    criar_ciclo,
    criar_plano,
    data_base_origem,
    impedimento,
    impedimento_ciclo,
    previa,
    previa_ciclo,
    previa_recalculo,
    renovacao_sem_ciclo,
)


class PlanoMarketingViewSet(RegistoViewSet):
    """Plano de Marketing de Imóveis (F4-03, D-53)."""

    modulo = "marketing-imoveis"
    ecra = "marketing_imoveis"
    modelo = PlanoMarketing
    nome_registo = "plano_marketing"
    http_method_names = ["get", "post", "patch", "delete"]
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "previa": Operacao.CRIAR,
        "situacao": Operacao.CONSULTAR,
        "previa_ciclo": Operacao.CRIAR,
        "novo_ciclo": Operacao.CRIAR,
        "incluir": Operacao.EDITAR,
        "previa_recalculo": Operacao.CONSULTAR,
        "pedir_recalculo": Operacao.EDITAR,
        "decidir_recalculo": Operacao.APROVAR,
    }
    campos_auditados = ["observacoes", "responsavel_id"]

    def get_serializer_class(self):
        return PlanoListaSerializer if self.action == "list" else PlanoSerializer

    def base_queryset(self):
        return PlanoMarketing.objects.select_related(
            "imovel__tipo", "imovel__tipologia", "angariacao", "responsavel"
        ).prefetch_related("pedidos_recalculo__pedido_por", "pedidos_recalculo__decidido_por")

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(imovel__referencia__iexact=termo)
                | Q(angariacao__referencia__iexact=termo)
                | Q(imovel__localidade__unaccent__icontains=termo)
            )
        if p.get("imovel"):
            qs = qs.filter(imovel_id=p["imovel"])
        if p.get("angariacao"):
            qs = qs.filter(angariacao_id=p["angariacao"])
        return qs.order_by("-criado_em", "-id")

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in ("pesquisa", "imovel", "angariacao")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def _cmi(self, pk):
        qs = filtrar(self.request.user, "angariacoes", Operacao.CONSULTAR, Angariacao.objects.ativos(),
                     campo_partilhas="partilhada_com")  # fmt: skip
        cmi = qs.select_related("imovel__responsavel").filter(pk=pk).first() if str(pk or "").isdigit() else None
        if cmi is None:
            raise serializers.ValidationError({"angariacao": "CMI inexistente ou sem acesso."})
        return cmi

    @extend_schema(parameters=[OpenApiParameter("angariacao", int, required=True)])
    @action(detail=False, methods=["get"])
    def previa(self, request):
        """As 45 ocorrências que «Criar plano inicial» vai criar (nada é gravado)."""
        cmi = self._cmi(request.query_params.get("angariacao"))
        motivo = impedimento(cmi)
        if motivo:
            return Response({"detail": motivo, "codigo": "impedido"}, status=status.HTTP_409_CONFLICT)
        return Response(previa(cmi))

    @extend_schema(request=CriarPlanoSerializer)
    def create(self, request, *args, **kwargs):
        s = CriarPlanoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        cmi = self._cmi(s.validated_data["angariacao"].pk)
        with transaction.atomic():
            cmi = Angariacao.objects.select_for_update().select_related("imovel__responsavel").get(pk=cmi.pk)
            motivo = impedimento(cmi)
            if motivo:
                raise serializers.ValidationError({"angariacao": motivo})
            plano = criar_plano(cmi, set(s.validated_data["excluidos"]), request.user, request=request)
        return Response(self.get_serializer(self.recarregar(plano)).data, status=status.HTTP_201_CREATED)

    @extend_schema(parameters=[OpenApiParameter("angariacao", int, required=True)])
    @action(detail=False, methods=["get"])
    def situacao(self, request):
        """O que se pode fazer neste CMI: plano inicial e/ou novo ciclo após renovação (sem gravar nada)."""
        cmi = self._cmi(request.query_params.get("angariacao"))
        r = renovacao_sem_ciclo(cmi)
        return Response({
            "plano_inicial": impedimento(cmi) is None,
            "motivo_inicial": impedimento(cmi),
            "novo_ciclo": {"renovacao": r.pk, "ciclo": r.ciclo, "data_inicio": r.data_inicio} if r else None,
        })  # fmt: skip

    @extend_schema(parameters=[OpenApiParameter("angariacao", int, required=True), OpenApiParameter("origem", str)])
    @action(detail=False, methods=["get"], url_path="previa-ciclo")
    def previa_ciclo(self, request):
        """Prévia do novo ciclo após renovação (Cap. 19): origem escolhida e pendentes do ciclo anterior."""
        cmi = self._cmi(request.query_params.get("angariacao"))
        origem = request.query_params.get("origem") or "catalogo"
        if origem not in ORIGENS_CICLO:
            raise serializers.ValidationError({"origem": "Origem inválida."})
        motivo = impedimento_ciclo(cmi)
        if motivo:
            return Response({"detail": motivo, "codigo": "impedido"}, status=status.HTTP_409_CONFLICT)
        return Response(previa_ciclo(cmi, origem))

    @extend_schema(request=NovoCicloSerializer)
    @action(detail=False, methods=["post"], url_path="novo-ciclo")
    def novo_ciclo(self, request):
        """Cria o novo ciclo após confirmação expressa. Um só ciclo por renovação (bloqueio do CMI)."""
        s = NovoCicloSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        cmi = self._cmi(d["angariacao"].pk)
        with transaction.atomic():
            cmi = Angariacao.objects.select_for_update().select_related("imovel__responsavel").get(pk=cmi.pk)
            motivo = impedimento_ciclo(cmi)
            if motivo:
                raise serializers.ValidationError({"angariacao": motivo})
            plano = criar_ciclo(cmi, set(d["excluidos"]), d["origem"], d["destino"], request.user, request=request)
        return Response(self.get_serializer(self.recarregar(plano)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=IncluirSerializer)
    @action(detail=True, methods=["post"])
    def incluir(self, request, pk=None):
        """Marca ou desmarca «Incluir» numa ocorrência. Uma ocorrência concluída não se desmarca."""
        s = IncluirSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        plano = self.get_object()
        with transaction.atomic():
            t = Tarefa.objects.select_for_update().filter(plano=plano, pk=s.validated_data["tarefa"]).first()
            if t is None:
                raise serializers.ValidationError({"tarefa": "Ocorrência inexistente neste plano."})
            novo = s.validated_data["incluida"]
            if not novo and t.estado and t.estado.categoria == "concluida":
                raise serializers.ValidationError({"tarefa": "Uma ocorrência concluída não pode ser desmarcada."})
            if t.incluida != novo:
                t.incluida, t.atualizado_por = novo, request.user
                t.save()
                registar("plano_marketing.incluir", modulo=self.modulo, objeto=plano, request=request,
                         dados={"tarefa": t.referencia, "numero": t.mk_numero, "incluida": novo})  # fmt: skip
        return Response(self.get_serializer(self.recarregar(plano)).data)

    @action(detail=True, methods=["get"], url_path="previa-recalculo")
    def previa_recalculo(self, request, pk=None):
        """Prazos novos das ocorrências pendentes, pela data de início atual do CMI."""
        plano = self.get_object()
        nova = data_base_origem(plano)
        return Response({
            "data_base_atual": plano.data_base,
            "data_base_nova": nova,
            "ocorrencias": previa_recalculo(plano, nova) if nova and nova != plano.data_base else [],
        })  # fmt: skip

    @extend_schema(request=PedirRecalculoSerializer)
    @action(detail=True, methods=["post"], url_path="pedir-recalculo")
    def pedir_recalculo(self, request, pk=None):
        """O consultor responsável pede o recálculo dos prazos após a correção da data de início do CMI."""
        s = PedirRecalculoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            plano = PlanoMarketing.objects.select_for_update().get(pk=self.get_object().pk)
            nova = data_base_origem(plano)
            if not nova or nova == plano.data_base:
                raise serializers.ValidationError(
                    {"detail": "A data de início do CMI é igual à data-base do plano: não há nada a recalcular."}
                )
            if plano.pedidos_recalculo.filter(estado=PedidoRecalculo.Estado.PENDENTE).exists():
                raise serializers.ValidationError({"detail": "Já há um pedido de recálculo à espera de decisão."})
            pedido = PedidoRecalculo.objects.create(
                plano=plano, data_base_anterior=plano.data_base, data_base_nova=nova,
                motivo=s.validated_data["motivo"].strip(), pedido_por=request.user,
            )  # fmt: skip
            registar("plano_marketing.recalculo_pedido", modulo=self.modulo, objeto=plano, request=request,
                     dados={"de": str(plano.data_base), "para": str(nova), "motivo": pedido.motivo})  # fmt: skip
        return Response(self.get_serializer(self.recarregar(plano)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=DecidirRecalculoSerializer)
    @action(detail=True, methods=["post"], url_path="decidir-recalculo")
    def decidir_recalculo(self, request, pk=None):
        """Aprovar ou recusar o pedido pendente. Quem pediu não decide (aprovação independente)."""
        s = DecidirRecalculoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            plano = PlanoMarketing.objects.select_for_update().get(pk=self.get_object().pk)
            pedido = plano.pedidos_recalculo.select_for_update().filter(estado=PedidoRecalculo.Estado.PENDENTE).first()
            if pedido is None:
                raise serializers.ValidationError({"detail": "Não há pedido de recálculo pendente."})
            if pedido.pedido_por_id == request.user.pk:
                raise PermissionDenied("Quem pediu o recálculo não o pode aprovar nem recusar.")
            aprovar, motivo = s.validated_data["aprovar"], s.validated_data["motivo"].strip()
            if not aprovar and not motivo:
                raise serializers.ValidationError({"motivo": "Indique o motivo da recusa."})
            pedido.estado = PedidoRecalculo.Estado.APROVADO if aprovar else PedidoRecalculo.Estado.RECUSADO
            pedido.decidido_por, pedido.decidido_em, pedido.motivo_decisao = request.user, timezone.now(), motivo
            pedido.save()
            if aprovar:
                aplicar_recalculo(plano, pedido.data_base_nova, request.user)
            registar("plano_marketing.recalculo_decidido", modulo=self.modulo, objeto=plano, request=request,
                     dados={"aprovado": aprovar, "para": str(pedido.data_base_nova), "motivo": motivo})  # fmt: skip
        return Response(self.get_serializer(self.recarregar(plano)).data)

    def destroy(self, request, *args, **kwargs):
        plano = self.get_object()
        if plano.tarefas.filter(estado__categoria="concluida").exists():
            raise serializers.ValidationError(
                {"detail": "O plano já tem ocorrências concluídas: não pode ser eliminado."}
            )
        if not pode_no_registo(request.user, self.modulo, Operacao.ELIMINAR, plano, campo_partilhas="partilhada_com"):
            raise PermissionDenied()
        with transaction.atomic():
            for t in plano.tarefas.filter(eliminado_em__isnull=True):
                t.enviar_para_lixeira(request.user)
            return super().destroy(request, *args, **kwargs)
