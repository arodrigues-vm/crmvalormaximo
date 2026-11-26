from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar, pode_no_registo
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis
from apps.transacoes.models import Transacao

from .models import Beneficiario, Comissao, ExcecaoComissao
from .serializers import ComissaoListaSerializer, ComissaoSerializer, DecisaoSerializer, PedidoExcecaoSerializer
from .servicos import fotografia


def transacoes_visiveis(utilizador) -> set[int]:
    qs = filtrar(
        utilizador, "transacoes", Operacao.CONSULTAR, Transacao.objects.ativos(), campo_partilhas="partilhada_com"
    )
    return set(qs.values_list("pk", flat=True))


class ComissaoViewSet(RegistoViewSet):
    """Comissões (módulo «Faturação e Comissões»)."""

    modulo = "faturacao"
    ecra = "comissoes"
    modelo = Comissao
    nome_registo = "comissao"
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "recalcular": Operacao.EDITAR,
        "pedir_excecao": Operacao.EDITAR,
        "decidir_excecao": Operacao.CONSULTAR,  # a permissão de aprovar verifica-se na própria ação
        "proposta_prestacoes": Operacao.CONSULTAR,
        "prestacoes": Operacao.EDITAR,
    }
    campos_auditados = [
        "valor_calculado", "valor_final", "origem", "pct_angariacao", "lado_angariacao_nosso", "lado_venda_nosso",
        "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return ComissaoListaSerializer if self.action == "list" else ComissaoSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        ctx["transacoes_visiveis"] = transacoes_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Comissao.objects.select_related(
            "transacao__entidade", "transacao__imovel__tipo", "transacao__imovel__tipologia", "transacao__estado",
            "transacao__operacao", "transacao__consultor_imovel", "transacao__consultor_comprador",
            "transacao__agente_imovel__agencia", "transacao__agente_comprador__agencia", "responsavel",
        ).prefetch_related(
            Prefetch("beneficiarios", queryset=Beneficiario.objects.select_related("utilizador")),
            Prefetch("excecoes", queryset=ExcecaoComissao.objects.select_related("requerente", "decidido_por")),
        )  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(transacao__referencia__iexact=termo)
                | Q(transacao__entidade__nome_completo__unaccent__icontains=termo)
                | Q(transacao__imovel__referencia__icontains=termo)
                | Q(transacao__imovel__localidade__unaccent__icontains=termo)
            )
        vista = p.get("vista")
        if vista == "por_apurar":
            qs = qs.filter(valor_final__isnull=True)
        elif vista == "excecoes":
            qs = qs.filter(excecoes__estado=ExcecaoComissao.Estado.PENDENTE).distinct()
        if p.get("transacao"):
            qs = qs.filter(transacao_id=p["transacao"])
        return qs.order_by("-criado_em", "-id")

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in ("pesquisa", "vista", "transacao")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # O responsável da comissão é o da transação (os consultores veem as comissões dos seus negócios).
        t = Transacao.objects.filter(pk=request.data.get("transacao")).first()
        if t is not None and "responsavel" not in request.data:
            request.data["responsavel"] = t.responsavel_id
        return super().create(request, *args, **kwargs)

    def validar_responsavel(self, novo, atual=None):
        # Na criação, o responsável vem da transação (não é uma transferência feita pelo utilizador).
        if self.action == "create":
            return
        super().validar_responsavel(novo, atual)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        from apps.contas.models import Utilizador

        return Response(
            {
                "modos": [{"valor": v, "nome": n} for v, n in Beneficiario.Modo.choices],
                "lados": [{"valor": v, "nome": n} for v, n in Beneficiario.Lado.choices],
                "consultores": [
                    {"id": u.pk, "nome": u.nome} for u in Utilizador.objects.filter(is_active=True).order_by("nome")
                ],
                **self.permissoes_gerais(request),
            }
        )

    @action(detail=True, methods=["post"])
    def recalcular(self, request, pk=None):
        """Nova fotografia do CMI e do negócio (ex.: o CMI ou o valor da transação foram corrigidos)."""
        with transaction.atomic():
            c = Comissao.objects.select_for_update().get(pk=self.get_object().pk)
            if c.excecoes.filter(estado=ExcecaoComissao.Estado.PENDENTE).exists():
                raise serializers.ValidationError({"detail": "Há uma exceção pendente. Decida-a primeiro."})
            antes = {"valor_calculado": str(c.valor_calculado), "valor_final": str(c.valor_final)}
            for k, v in fotografia(c.transacao).items():
                setattr(c, k, v)
            if c.origem == Comissao.Origem.CALCULADO or (c.origem == Comissao.Origem.MANUAL and c.valor_calculado):
                c.valor_final, c.origem = c.valor_calculado, Comissao.Origem.CALCULADO
            c.atualizado_por = request.user
            c.save()
            registar("comissao.recalculada", modulo=self.modulo, objeto=c, request=request,
                     dados={"antes": antes, "depois": {"valor_calculado": str(c.valor_calculado),
                                                       "valor_final": str(c.valor_final)}})  # fmt: skip
        return Response(self.get_serializer(self.recarregar(c)).data)

    @extend_schema(request=PedidoExcecaoSerializer)
    @action(detail=True, methods=["post"], url_path="excecoes")
    def pedir_excecao(self, request, pk=None):
        """Pede a alteração excecional do valor (Q13). Só fica em vigor depois de aprovada por outra pessoa."""
        s = PedidoExcecaoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            c = Comissao.objects.select_for_update().get(pk=self.get_object().pk)
            if c.excecoes.filter(estado=ExcecaoComissao.Estado.PENDENTE).exists():
                raise serializers.ValidationError({"detail": "Já há uma exceção pendente para esta comissão."})
            if c.valor_final is not None and s.validated_data["valor_proposto"] == c.valor_final:
                raise serializers.ValidationError({"valor_proposto": "O valor proposto é igual ao atual."})
            e = ExcecaoComissao.objects.create(
                comissao=c, valor_original=c.valor_final, requerente=request.user, **s.validated_data
            )
            registar("comissao.excecao_pedida", modulo=self.modulo, objeto=c, request=request,
                     dados={"de": str(c.valor_final), "para": str(e.valor_proposto), "motivo": e.motivo})  # fmt: skip
        return Response(self.get_serializer(self.recarregar(c)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=DecisaoSerializer)
    @action(detail=True, methods=["post"], url_path=r"excecoes/(?P<excecao_id>\d+)/decidir")
    def decidir_excecao(self, request, pk=None, excecao_id=None):
        """Aprovar ou recusar (Administrador ou Responsável autorizado). Sem autoaprovação nem conflito de
        interesses: quem pediu ou quem recebe parte da comissão não decide."""
        s = DecisaoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            c = Comissao.objects.select_for_update().get(pk=self.get_object().pk)
            if not pode_no_registo(request.user, self.modulo, Operacao.APROVAR, c, campo_partilhas="partilhada_com"):
                raise PermissionDenied("Não tem permissão para aprovar exceções de comissão.")
            e = c.excecoes.filter(pk=excecao_id).first()
            if e is None:
                return Response(status=status.HTTP_404_NOT_FOUND)
            if e.estado != ExcecaoComissao.Estado.PENDENTE:
                raise serializers.ValidationError({"detail": "Esta exceção já foi decidida."})
            if e.requerente_id == request.user.pk:
                raise PermissionDenied("Não pode decidir uma exceção que pediu.")
            if c.beneficiarios.filter(utilizador=request.user).exists():
                raise PermissionDenied("Conflito de interesses: recebe parte desta comissão.")
            aprovar = s.validated_data["aprovar"]
            if not aprovar and not s.validated_data["motivo"].strip():
                raise serializers.ValidationError({"motivo": "Indique o motivo da recusa."})
            e.estado = ExcecaoComissao.Estado.APROVADA if aprovar else ExcecaoComissao.Estado.RECUSADA
            e.decidido_por, e.decidido_em = request.user, timezone.now()
            e.motivo_decisao = s.validated_data["motivo"].strip()
            e.save()
            if aprovar:
                c.valor_final, c.origem = e.valor_proposto, Comissao.Origem.EXCECAO
                c.atualizado_por = request.user
                c.save()
            registar("comissao.excecao_decidida", modulo=self.modulo, objeto=c, request=request,
                     dados={"excecao": e.pk, "decisao": e.estado, "motivo": e.motivo_decisao})  # fmt: skip
        return Response(self.get_serializer(self.recarregar(c)).data)

    # Prestações dos consultores (D-49) ------------------------------------------------------

    @action(detail=True, methods=["get"], url_path="prestacoes/proposta")
    def proposta_prestacoes(self, request, pk=None):
        """Prestações propostas segundo o momento de pagamento do CMI. NÃO grava nada."""
        from apps.faturacao.servicos import proposta_prestacoes

        return Response(proposta_prestacoes(self.get_object()))

    @action(detail=True, methods=["put"])
    def prestacoes(self, request, pk=None):
        """Grava as prestações confirmadas (substitui as anteriores; os documentos ligados ficam sem prestação)."""
        from apps.faturacao.models import Prestacao
        from apps.faturacao.serializers import PrestacaoSerializer

        with transaction.atomic():
            c = Comissao.objects.select_for_update().get(pk=self.get_object().pk)
            s = PrestacaoSerializer(data=request.data.get("prestacoes", []), many=True)
            s.is_valid(raise_exception=True)
            consultores = set(c.beneficiarios.values_list("utilizador_id", flat=True))
            if any(p["utilizador"].pk not in consultores for p in s.validated_data):
                raise serializers.ValidationError({"prestacoes": "Só consultores que recebem parte desta comissão."})
            antes = list(c.prestacoes.values("utilizador_id", "momento", "valor"))
            c.prestacoes.all().delete()
            for ordem, p in enumerate(s.validated_data):
                Prestacao.objects.create(comissao=c, ordem=ordem, **p)
            registar(
                "comissao.prestacoes",
                modulo=self.modulo,
                objeto=c,
                request=request,
                dados={"antes": [{**a, "valor": str(a["valor"])} for a in antes], "depois": len(s.validated_data)},
            )
        return Response(self.get_serializer(self.recarregar(c)).data)
