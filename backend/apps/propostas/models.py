"""Propostas (Especificação Cap. 11, F3-04, Q12/Q16, AT-08, D-39).

- Uma proposta por negociação (comprador × imóvel), com **rondas**: cada oferta ou contraproposta é uma
  ronda imutável (quem propôs, valor, condições, prazos). O valor atual é o da última ronda.
- «Gerar Proposta» a partir de uma Visita: pré-preenchido, só grava ao confirmar, sem duplicados.
- Participantes guardados na própria proposta (fotografia): mudanças posteriores na titularidade do
  imóvel não alteram a proposta (Q16/AT-11).
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase

VALOR = {"max_digits": 12, "decimal_places": 2, "validators": [MinValueValidator(0)]}


class Proposta(RegistoBase):
    PREFIXO_REFERENCIA = "PRP"

    visita = models.ForeignKey(
        "visitas.Visita", null=True, blank=True, on_delete=models.PROTECT, related_name="propostas",
        verbose_name="visita de origem",
    )  # fmt: skip
    imovel = models.ForeignKey(
        "imoveis.Imovel", null=True, blank=True, on_delete=models.PROTECT, related_name="propostas"
    )
    imovel_descricao = models.CharField("descrição do imóvel (não registado)", max_length=255, blank=True)
    imovel_localizacao = models.CharField("localização do imóvel (não registado)", max_length=200, blank=True)
    entidade = models.ForeignKey(
        "entidades.Entidade", on_delete=models.PROTECT, related_name="propostas", verbose_name="comprador"
    )
    agente_comprador = models.ForeignKey(
        "agentes.Agente", null=True, on_delete=models.PROTECT, related_name="+",
        verbose_name="agente responsável pelo comprador",
    )  # fmt: skip
    agente_imovel = models.ForeignKey(
        "agentes.Agente", null=True, on_delete=models.PROTECT, related_name="+",
        verbose_name="agente responsável pelo imóvel",
    )  # fmt: skip
    # D-46: quando o responsável é da nossa Equipa (imóvel de angariação própria / cliente nosso), vem da ficha
    # do imóvel / da entidade e fica guardado aqui; os agentes acima ficam para imóveis/clientes de fora.
    consultor_comprador = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+",
        verbose_name="responsável pela entidade (Equipa)",
    )  # fmt: skip
    consultor_imovel = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+",
        verbose_name="responsável pelo imóvel (Equipa)",
    )  # fmt: skip
    estado = campo_lista("estados_proposta")

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "proposta"
        verbose_name_plural = "propostas"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.referencia or f"Proposta {self.pk}"

    @property
    def ultima_ronda(self):
        return self.rondas.order_by("-numero").first()


class Participante(models.Model):
    """Fotografia dos participantes da proposta (compradores, proprietários, representantes…)."""

    proposta = models.ForeignKey(Proposta, on_delete=models.CASCADE, related_name="participantes")
    entidade = models.ForeignKey("entidades.Entidade", on_delete=models.PROTECT, related_name="+")
    papel = campo_lista("papeis_participante")
    quota = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    ordem = models.PositiveSmallIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["ordem", "id"]
        constraints = [models.UniqueConstraint(fields=["proposta", "entidade"], name="participante_unico")]

    def __str__(self):
        return str(self.entidade)


class Ronda(models.Model):
    """Uma oferta (do comprador) ou contraproposta (do proprietário). Não se edita: acrescenta-se outra."""

    class Autor(models.TextChoices):
        COMPRADOR = "comprador", "Comprador"
        PROPRIETARIO = "proprietario", "Proprietário"

    class Unidade(models.TextChoices):
        PERCENTAGEM = "percentagem", "% do valor"
        EUROS = "euros", "€"

    proposta = models.ForeignKey(Proposta, on_delete=models.PROTECT, related_name="rondas")
    numero = models.PositiveSmallIntegerField()
    autor = models.CharField(max_length=12, choices=Autor.choices)
    data = models.DateField()
    valor = models.DecimalField("valor", **VALOR)
    sinal_valor = models.DecimalField("sinal", null=True, blank=True, **VALOR)
    sinal_unidade = models.CharField(max_length=12, choices=Unidade.choices, blank=True)
    modo_pagamento = campo_lista("modos_pagamento", verbose_name="modo de pagamento")
    financiamento = campo_lista("sim_nao", verbose_name="depende de financiamento")
    data_cpcv = models.DateField("data prevista do CPCV", null=True, blank=True)
    data_escritura = models.DateField("data prevista da escritura", null=True, blank=True)
    validade = models.DateField("válida até", null=True, blank=True)
    condicoes = models.TextField("condições especiais", blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["proposta", "numero"]
        verbose_name = "ronda de negociação"
        verbose_name_plural = "rondas de negociação"
        constraints = [models.UniqueConstraint(fields=["proposta", "numero"], name="ronda_numero_unico")]

    def __str__(self):
        return f"{self.proposta} — ronda {self.numero}"
