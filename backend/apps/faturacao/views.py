from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.comissoes.models import Comissao
from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar, pode_no_registo
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet

from .models import DocumentoConsultor, Movimento
from .serializers import (
    DecisaoSerializer,
    DocumentoListaSerializer,
    DocumentoSerializer,
    EstornoSerializer,
    PagamentoSerializer,
)
from .servicos import estornavel, pago

MODULO = "faturacao"


def comissoes_editaveis(utilizador) -> set[int]:
    qs = filtrar(utilizador, MODULO, Operacao.EDITAR, Comissao.objects.ativos(), campo_partilhas="partilhada_com")
    return set(qs.values_list("pk", flat=True))


class DocumentoViewSet(RegistoViewSet):
    """Documentos que os consultores emitem à agência e o respetivo livro de pagamentos (D-49)."""

    modulo = MODULO
    ecra = "documentos_consultor"
    modelo = DocumentoConsultor
    nome_registo = "documento"
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "pagamento": Operacao.EDITAR,
        "estorno": Operacao.EDITAR,
        "decidir_estorno": Operacao.CONSULTAR,  # a permissão de aprovar verifica-se na ação
    }
    campos_auditados = [
        "comissao_id",
        "consultor_id",
        "prestacao_id",
        "tipo_id",
        "serie",
        "numero",
        "data_emissao",
        "base",
        "taxa_iva",
        "iva",
        "retencao",
        "total",
        "documento_original_id",
        "observacoes",
    ]

    def get_serializer_class(self):
        return DocumentoListaSerializer if self.action == "list" else DocumentoSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["comissoes_editaveis"] = comissoes_editaveis(self.request.user)
        return ctx

    def base_queryset(self):
        return DocumentoConsultor.objects.select_related(
            "consultor", "tipo", "comissao__transacao", "prestacao", "documento_original"
        ).prefetch_related(
            Prefetch(
                "movimentos",
                queryset=Movimento.objects.select_related("meio", "criado_por", "decidido_por").prefetch_related(
                    "estornos"
                ),
            )
        )

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(numero__icontains=termo)
                | Q(consultor__nome__unaccent__icontains=termo)
                | Q(comissao__referencia__iexact=termo)
                | Q(comissao__transacao__referencia__iexact=termo)
            )
        for parametro, campo in (("comissao", "comissao_id"), ("consultor", "consultor_id")):
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        return qs.order_by("-data_emissao", "-id")

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in ("pesquisa", "comissao", "consultor")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # O responsável do documento é o consultor: assim vê os seus documentos e pagamentos.
        if hasattr(request.data, "_mutable"):
            request.data._mutable = True
        request.data["responsavel"] = request.data.get("consultor")
        return super().create(request, *args, **kwargs)

    def validar_responsavel(self, novo, atual=None):
        if self.action == "create":
            return  # o responsável é sempre o consultor que emitiu o documento
        super().validar_responsavel(novo, atual)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.movimentos.exists():
            raise serializers.ValidationError(
                {"detail": "Este documento tem pagamentos: não vai para a lixeira. Registe uma nota de crédito."}
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "tipos": opcoes_lista("tipos_documento_consultor"),
                "meios": opcoes_lista("meios_pagamento"),
                **self.permissoes_gerais(request),
            }
        )

    def _documento(self):
        return DocumentoConsultor.objects.select_for_update().select_related("tipo").get(pk=self.get_object().pk)

    @extend_schema(request=PagamentoSerializer)
    @action(detail=True, methods=["post"])
    def pagamento(self, request, pk=None):
        """Regista um pagamento (pode ser parcial). Excesso em relação ao que falta pagar é recusado."""
        s = PagamentoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            d = self._documento()
            if d.credito:
                raise serializers.ValidationError({"detail": "Uma nota de crédito não se paga."})
            em_aberto = d.a_pagar - pago(d)
            if s.validated_data["valor"] > em_aberto:
                raise serializers.ValidationError(
                    {"valor": f"Excede o que falta pagar deste documento ({em_aberto} €)."}
                )
            if s.validated_data["data_efetiva"] > timezone.localdate():
                raise serializers.ValidationError({"data_efetiva": "A data do pagamento não pode ser no futuro."})
            m = Movimento.objects.create(
                documento=d,
                tipo=Movimento.Tipo.PAGAMENTO,
                estado=Movimento.Estado.EFETIVO,
                criado_por=request.user,
                **s.validated_data,
            )
            registar(
                "documento.pagamento",
                modulo=self.modulo,
                objeto=d,
                request=request,
                dados={"movimento": m.pk, "valor": str(m.valor), "data": str(m.data_efetiva)},
            )
        return Response(self.get_serializer(self.recarregar(d)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=EstornoSerializer)
    @action(detail=True, methods=["post"])
    def estorno(self, request, pk=None):
        """Pede um estorno (movimento inverso) de um pagamento. Só produz efeito depois de aprovado."""
        s = EstornoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            d = self._documento()
            original = d.movimentos.filter(
                pk=s.validated_data["pagamento"], tipo=Movimento.Tipo.PAGAMENTO, estado=Movimento.Estado.EFETIVO
            ).first()
            if original is None:
                raise serializers.ValidationError({"pagamento": "Pagamento inexistente neste documento."})
            Movimento.objects.select_for_update().filter(estorno_de=original).exists()
            disponivel = estornavel(original)
            if s.validated_data["valor"] > disponivel:
                raise serializers.ValidationError(
                    {"valor": f"Só pode estornar até {disponivel} € deste pagamento (inclui estornos pendentes)."}
                )
            if not s.validated_data["motivo"].strip():
                raise serializers.ValidationError({"motivo": "Indique o motivo do estorno."})
            m = Movimento.objects.create(
                documento=d,
                tipo=Movimento.Tipo.ESTORNO,
                estado=Movimento.Estado.PENDENTE,
                estorno_de=original,
                valor=s.validated_data["valor"],
                motivo=s.validated_data["motivo"].strip(),
                data_efetiva=s.validated_data["data_efetiva"],
                meio=original.meio,
                criado_por=request.user,
            )
            registar(
                "documento.estorno_pedido",
                modulo=self.modulo,
                objeto=d,
                request=request,
                dados={"movimento": m.pk, "de": original.pk, "valor": str(m.valor), "motivo": m.motivo},
            )
        return Response(self.get_serializer(self.recarregar(d)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=DecisaoSerializer)
    @action(detail=True, methods=["post"], url_path=r"estornos/(?P<movimento_id>\d+)/decidir")
    def decidir_estorno(self, request, pk=None, movimento_id=None):
        """Aprovação independente: quem pediu e o consultor do documento não decidem."""
        s = DecisaoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            d = self._documento()
            if not pode_no_registo(request.user, self.modulo, Operacao.APROVAR, d, campo_partilhas="partilhada_com"):
                raise PermissionDenied("Não tem permissão para aprovar estornos.")
            m = d.movimentos.filter(pk=movimento_id, tipo=Movimento.Tipo.ESTORNO).first()
            if m is None:
                return Response(status=status.HTTP_404_NOT_FOUND)
            if m.estado != Movimento.Estado.PENDENTE:
                raise serializers.ValidationError({"detail": "Este estorno já foi decidido."})
            if m.criado_por_id == request.user.pk:
                raise PermissionDenied("Não pode decidir um estorno que pediu.")
            if d.consultor_id == request.user.pk:
                raise PermissionDenied("Conflito de interesses: o documento é seu.")
            if not s.validated_data["aprovar"] and not s.validated_data["motivo"].strip():
                raise serializers.ValidationError({"motivo": "Indique o motivo da recusa."})
            m.estado = Movimento.Estado.EFETIVO if s.validated_data["aprovar"] else Movimento.Estado.RECUSADO
            m.decidido_por, m.decidido_em = request.user, timezone.now()
            m.motivo_decisao = s.validated_data["motivo"].strip()
            m.save(update_fields=["estado", "decidido_por", "decidido_em", "motivo_decisao"])
            registar(
                "documento.estorno_decidido",
                modulo=self.modulo,
                objeto=d,
                request=request,
                dados={"movimento": m.pk, "decisao": m.estado, "motivo": m.motivo_decisao},
            )
        return Response(self.get_serializer(self.recarregar(d)).data)
