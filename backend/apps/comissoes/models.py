"""Comissões (Especificação Cap. 13, F3-07, Q13, AT-07, D-48).

- A comissão total calcula-se no servidor a partir do CMI escolhido na transação e do valor do negócio, e
  guarda-se uma **fotografia** da base (modalidade, taxa/valor, mínimo, IVA, versão do CMI). Sem CMI ou com
  modalidade não calculável, fica «por apurar» até alguém indicar o valor (desconhecido ≠ zero).
- Divide-se em dois **lados**: angariação (quem tem o imóvel) e venda (quem tem o comprador); proposta por
  parâmetro (50/50 por omissão), alterável em cada comissão. Só controlamos os lados que são nossos.
- Em cada lado nosso, cada consultor recebe uma % do lado ou o lado menos um valor fixo da agência; o resto fica
  para a agência. Valores em Decimal, ao cêntimo, sem perder cêntimos.
- Mudar o valor calculado é uma **exceção**: pedido com motivo, aprovado por outra pessoa autorizada (sem
  autoaprovação e sem aprovar comissões de que se é beneficiário). Tudo fica no histórico.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.modelos_base import RegistoBase

CENTIMO = Decimal("0.01")
CEM = Decimal(100)
EUROS = {"max_digits": 12, "decimal_places": 2, "validators": [MinValueValidator(0)]}
PCT = {"max_digits": 5, "decimal_places": 2, "validators": [MinValueValidator(0), MaxValueValidator(100)]}


def arred(v: Decimal) -> Decimal:
    return v.quantize(CENTIMO, rounding=ROUND_HALF_UP)


class Comissao(RegistoBase):
    PREFIXO_REFERENCIA = "COM"

    class Origem(models.TextChoices):
        CALCULADO = "calculado", "Calculado a partir do CMI"
        MANUAL = "manual", "Indicado (não havia cálculo possível)"
        EXCECAO = "excecao", "Exceção aprovada"

    transacao = models.OneToOneField("transacoes.Transacao", on_delete=models.PROTECT, related_name="comissao")

    # Fotografia da base de cálculo (não muda se o CMI mudar depois; «Recalcular» tira nova fotografia).
    cmi_referencia = models.CharField(max_length=20, blank=True)
    cmi_versao = models.PositiveIntegerField(null=True, blank=True)
    modalidade = models.CharField(max_length=20, blank=True)
    taxa_ou_valor = models.DecimalField("taxa (%), valor fixo ou n.º de rendas", max_digits=12, decimal_places=4,
                                        null=True, blank=True)  # fmt: skip
    base_negocio = models.DecimalField("valor do negócio (ou renda mensal)", null=True, blank=True, **EUROS)
    minimo = models.DecimalField("remuneração mínima", null=True, blank=True, **EUROS)
    taxa_iva = models.DecimalField("taxa de IVA (%)", null=True, blank=True, **PCT)
    inclui_iva = models.BooleanField("valores do CMI com IVA incluído", null=True, blank=True)

    valor_calculado = models.DecimalField("comissão total calculada (sem IVA)", null=True, blank=True, **EUROS)
    valor_final = models.DecimalField("comissão total (sem IVA)", null=True, blank=True, **EUROS)
    origem = models.CharField(max_length=12, choices=Origem.choices, default=Origem.CALCULADO)

    pct_angariacao = models.DecimalField("% do lado da angariação", default=Decimal(50), **PCT)
    lado_angariacao_nosso = models.BooleanField("o lado da angariação é nosso", default=False)
    lado_venda_nosso = models.BooleanField("o lado da venda é nosso", default=False)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "comissão"
        verbose_name_plural = "comissões"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.referencia or f"Comissão {self.pk}"

    # Valores derivados (sempre no servidor) ---------------------------------------------------

    @property
    def lado_angariacao(self) -> Decimal | None:
        if self.valor_final is None:
            return None
        return arred(self.valor_final * self.pct_angariacao / CEM)

    @property
    def lado_venda(self) -> Decimal | None:
        # O resto, para a soma dos dois lados dar sempre o total ao cêntimo.
        return None if self.valor_final is None else self.valor_final - self.lado_angariacao

    @property
    def iva(self) -> Decimal | None:
        if self.valor_final is None or self.taxa_iva is None:
            return None
        return arred(self.valor_final * self.taxa_iva / CEM)

    def valor_do_lado(self, lado: str) -> Decimal | None:
        return self.lado_angariacao if lado == Beneficiario.Lado.ANGARIACAO else self.lado_venda

    def lado_nosso(self, lado: str) -> bool:
        return self.lado_angariacao_nosso if lado == Beneficiario.Lado.ANGARIACAO else self.lado_venda_nosso


class Beneficiario(models.Model):
    """Consultor que recebe parte de um lado nosso da comissão."""

    class Lado(models.TextChoices):
        ANGARIACAO = "angariacao", "Angariação"
        VENDA = "venda", "Venda"

    class Modo(models.TextChoices):
        PERCENTAGEM = "percentagem", "Percentagem do lado"
        DEDUCAO = "deducao", "Lado menos um valor fixo da agência"

    comissao = models.ForeignKey(Comissao, on_delete=models.CASCADE, related_name="beneficiarios")
    lado = models.CharField(max_length=12, choices=Lado.choices)
    utilizador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    modo = models.CharField(max_length=12, choices=Modo.choices, blank=True)
    percentagem = models.DecimalField(null=True, blank=True, **PCT)
    deducao = models.DecimalField("valor fixo da agência", null=True, blank=True, **EUROS)
    ordem = models.PositiveSmallIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["lado", "ordem", "id"]

    def __str__(self):
        return f"{self.utilizador} ({self.get_lado_display()})"

    @property
    def valor(self) -> Decimal | None:
        """Valor do consultor (sem IVA). Desconhecido se faltar a forma de cálculo ou o valor do lado."""
        lado = self.comissao.valor_do_lado(self.lado)
        if lado is None:
            return None
        if self.modo == self.Modo.PERCENTAGEM and self.percentagem is not None:
            return arred(lado * self.percentagem / CEM)
        if self.modo == self.Modo.DEDUCAO and self.deducao is not None:
            return max(lado - self.deducao, Decimal(0))
        return None


class ExcecaoComissao(models.Model):
    """Pedido de alteração do valor calculado (Q13). Depois de decidido, não se altera."""

    class Estado(models.TextChoices):
        PENDENTE = "pendente", "Pendente"
        APROVADA = "aprovada", "Aprovada"
        RECUSADA = "recusada", "Recusada"

    comissao = models.ForeignKey(Comissao, on_delete=models.PROTECT, related_name="excecoes")
    valor_original = models.DecimalField(null=True, blank=True, **EUROS)
    valor_proposto = models.DecimalField(**EUROS)
    motivo = models.TextField()
    requerente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    criado_em = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDENTE)
    decidido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    decidido_em = models.DateTimeField(null=True, blank=True)
    motivo_decisao = models.TextField(blank=True)

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "exceção de comissão"
        verbose_name_plural = "exceções de comissão"

    def __str__(self):
        return f"{self.comissao}: {self.valor_original} → {self.valor_proposto}"
