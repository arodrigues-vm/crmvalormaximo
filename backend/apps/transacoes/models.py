"""Transações (Especificação Cap. 12, F3-05/F3-06, Q12/Q14/Q16, AT-09/AT-11, D-47).

- «Gerar Transação» só a partir de uma Proposta aceite, com escolha expressa do CMI (quando o imóvel tem CMI),
  pré-preenchida e gravada só ao confirmar; nunca duas transações ativas para a mesma proposta.
- Participantes guardados na própria transação (fotografia): mudanças posteriores na titularidade do imóvel ou
  na proposta não a alteram.
- Estados (lista configurável com categoria): Em preparação → CPCV assinado → Escritura marcada → Concluída, ou
  Cancelada. No arrendamento não há CPCV nem escritura: Em preparação → Concluída (contrato assinado).
- Ao concluir, o CRM propõe efeitos sobre o Imóvel e o CMI; só aplica os que o utilizador confirmar, e
  regista-os para os poder desfazer ao reabrir.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase

VALOR = {"max_digits": 12, "decimal_places": 2, "validators": [MinValueValidator(0)]}


class Transacao(RegistoBase):
    PREFIXO_REFERENCIA = "TRA"

    class Unidade(models.TextChoices):
        PERCENTAGEM = "percentagem", "% do valor"
        EUROS = "euros", "€"

    proposta = models.ForeignKey(
        "propostas.Proposta", on_delete=models.PROTECT, related_name="transacoes", verbose_name="proposta de origem"
    )
    imovel = models.ForeignKey(
        "imoveis.Imovel", null=True, blank=True, on_delete=models.PROTECT, related_name="transacoes"
    )
    imovel_descricao = models.CharField("descrição do imóvel (não registado)", max_length=255, blank=True)
    imovel_localizacao = models.CharField("localização do imóvel (não registado)", max_length=200, blank=True)
    entidade = models.ForeignKey(
        "entidades.Entidade", on_delete=models.PROTECT, related_name="transacoes", verbose_name="comprador"
    )
    angariacao = models.ForeignKey(
        "angariacoes.Angariacao", null=True, blank=True, on_delete=models.PROTECT, related_name="transacoes",
        verbose_name="CMI",
    )  # fmt: skip
    operacao = campo_lista("operacoes", verbose_name="operação")
    estado = campo_lista("estados_transacao")
    motivo_estado = models.CharField("motivo da última mudança de estado", max_length=500, blank=True)

    valor = models.DecimalField("valor acordado", **VALOR)
    sinal_valor = models.DecimalField("sinal", null=True, blank=True, **VALOR)
    sinal_unidade = models.CharField(max_length=12, choices=Unidade.choices, blank=True)
    data_cpcv_prevista = models.DateField("data prevista do CPCV", null=True, blank=True)
    data_cpcv = models.DateField("data do CPCV", null=True, blank=True)
    # Na venda: escritura. No arrendamento: assinatura do contrato.
    data_escritura_prevista = models.DateField("data prevista da escritura / contrato", null=True, blank=True)
    data_escritura = models.DateField("data da escritura / contrato", null=True, blank=True)

    # Fotografia dos responsáveis da proposta (D-46).
    agente_comprador = models.ForeignKey(
        "agentes.Agente", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    agente_imovel = models.ForeignKey(
        "agentes.Agente", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    consultor_comprador = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    consultor_imovel = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    # Efeitos aplicados ao Imóvel/CMI com confirmação (Q14): [{chave, descricao, antes, depois, em, por, revertido}]
    efeitos_aplicados = models.JSONField(default=list, blank=True, editable=False)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "transação"
        verbose_name_plural = "transações"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]
        constraints = [
            # Proteção contra duplicados: uma transação ativa por proposta.
            models.UniqueConstraint(
                fields=["proposta"], condition=Q(eliminado_em__isnull=True), name="transacao_unica_por_proposta"
            )
        ]

    def __str__(self):
        return self.referencia or f"Transação {self.pk}"

    @property
    def arrendamento(self) -> bool:
        return bool(self.operacao and self.operacao.categoria == "arrendamento")


class ParticipanteTransacao(models.Model):
    """Fotografia dos participantes da transação (compradores, proprietários, representantes…)."""

    transacao = models.ForeignKey(Transacao, on_delete=models.CASCADE, related_name="participantes")
    entidade = models.ForeignKey("entidades.Entidade", on_delete=models.PROTECT, related_name="+")
    papel = campo_lista("papeis_participante")
    quota = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    ordem = models.PositiveSmallIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["ordem", "id"]
        constraints = [models.UniqueConstraint(fields=["transacao", "entidade"], name="participante_transacao_unico")]

    def __str__(self):
        return str(self.entidade)
