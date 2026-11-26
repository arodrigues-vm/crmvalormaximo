"""Faturação dos consultores à agência e pagamentos (Especificação Cap. 14, F3-08, AT-07, D-49).

O CRM **não emite** faturas: regista os documentos que cada consultor emite à agência pela sua parte da comissão
(fatura, fatura-recibo, recibo, nota de crédito) e os **pagamentos** que a agência lhe faz.

- **Prestações**: a parte de cada consultor divide-se segundo o momento de pagamento do CMI (ex.: 50% no CPCV e
  50% na escritura). O CRM propõe; o utilizador confirma e pode ajustar.
- **Livro de pagamentos imutável**: cada pagamento é um movimento; nunca se altera nem se apaga. Para corrigir,
  regista-se um **estorno** (movimento inverso, ligado ao original, com motivo), que só produz efeito depois de
  aprovado por outra pessoa autorizada. Estornos pendentes comprometem o saldo.
- Base, IVA, retenção e total por documento; datas efetiva e de registo separadas; valores em Decimal.
"""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase

EUROS = {"max_digits": 12, "decimal_places": 2, "validators": [MinValueValidator(0)]}
PCT = {"max_digits": 5, "decimal_places": 2, "validators": [MinValueValidator(0), MaxValueValidator(100)]}
ZERO = Decimal(0)


class Prestacao(models.Model):
    """Parte de um consultor a pagar num momento (CPCV, escritura…)."""

    class Momento(models.TextChoices):
        CPCV = "cpcv", "No CPCV"
        ESCRITURA = "escritura", "Na escritura / contrato"
        OUTRO = "outro", "Outro momento"

    comissao = models.ForeignKey("comissoes.Comissao", on_delete=models.CASCADE, related_name="prestacoes")
    utilizador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    momento = models.CharField(max_length=12, choices=Momento.choices)
    percentagem = models.DecimalField(null=True, blank=True, **PCT)
    valor = models.DecimalField(**EUROS)
    data_prevista = models.DateField(null=True, blank=True)
    ordem = models.PositiveSmallIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["utilizador_id", "ordem", "id"]
        verbose_name = "prestação"
        verbose_name_plural = "prestações"

    def __str__(self):
        return f"{self.utilizador} — {self.get_momento_display()}: {self.valor}"


class DocumentoConsultor(RegistoBase):
    """Documento emitido por um consultor à agência (registo de um documento externo)."""

    PREFIXO_REFERENCIA = "DOC"

    comissao = models.ForeignKey("comissoes.Comissao", on_delete=models.PROTECT, related_name="documentos")
    consultor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    prestacao = models.ForeignKey(
        Prestacao, null=True, blank=True, on_delete=models.SET_NULL, related_name="documentos"
    )
    tipo = campo_lista("tipos_documento_consultor", null=False, blank=False)
    serie = models.CharField("série", max_length=30, blank=True)
    numero = models.CharField("número", max_length=30)
    data_emissao = models.DateField("data de emissão")
    base = models.DecimalField("base (sem IVA)", **EUROS)
    taxa_iva = models.DecimalField("taxa de IVA (%)", null=True, blank=True, **PCT)
    iva = models.DecimalField("IVA", default=ZERO, **EUROS)
    retencao = models.DecimalField("retenção na fonte", default=ZERO, **EUROS)
    total = models.DecimalField("total do documento", **EUROS)
    documento_original = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="retificacoes",
        verbose_name="documento retificado (nota de crédito)",
    )  # fmt: skip

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-data_emissao", "-id"]
        verbose_name = "documento de consultor"
        verbose_name_plural = "documentos de consultores"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]
        constraints = [
            # Controlo de duplicados: o mesmo consultor não regista duas vezes o mesmo documento.
            models.UniqueConstraint(
                fields=["consultor", "tipo", "serie", "numero"], condition=Q(eliminado_em__isnull=True),
                name="documento_consultor_unico",
            )
        ]  # fmt: skip

    def __str__(self):
        return f"{self.referencia or 'Documento'} ({self.serie} {self.numero})".strip()

    @property
    def credito(self) -> bool:
        return bool(self.tipo and self.tipo.categoria == "credito")

    @property
    def a_pagar(self) -> Decimal:
        """Valor que a agência paga por este documento (total menos retenção). Notas de crédito: negativo."""
        valor = self.total - self.retencao
        return -valor if self.credito else valor


class Movimento(models.Model):
    """Livro de pagamentos (imutável): pagamentos e estornos. Nunca se altera nem se apaga."""

    class Tipo(models.TextChoices):
        PAGAMENTO = "pagamento", "Pagamento"
        ESTORNO = "estorno", "Estorno"

    class Estado(models.TextChoices):
        EFETIVO = "efetivo", "Efetivo"
        PENDENTE = "pendente", "Pendente de aprovação"
        RECUSADO = "recusado", "Recusado"

    documento = models.ForeignKey(DocumentoConsultor, on_delete=models.PROTECT, related_name="movimentos")
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    estado = models.CharField(max_length=10, choices=Estado.choices)
    data_efetiva = models.DateField("data efetiva")
    registado_em = models.DateTimeField("registado em", auto_now_add=True)
    valor = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    meio = campo_lista("meios_pagamento", verbose_name="meio de pagamento")
    referencia_pagamento = models.CharField("referência", max_length=60, blank=True)
    estorno_de = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="estornos")
    motivo = models.TextField(blank=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    decidido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    decidido_em = models.DateTimeField(null=True, blank=True)
    motivo_decisao = models.TextField(blank=True)

    class Meta:
        ordering = ["data_efetiva", "registado_em", "id"]
        verbose_name = "movimento de pagamento"
        verbose_name_plural = "movimentos de pagamento"

    def __str__(self):
        return f"{self.get_tipo_display()} {self.valor} ({self.documento})"
