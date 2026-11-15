"""Oportunidades de Angariação: contactos com proprietários ANTES de existir um CMI.

Não se confundem com angariações: a passagem a Imóvel/CMI é uma ação expressa, confirmada e
auditada (Especificação Cap. 8)."""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase


class Oportunidade(RegistoBase):
    PREFIXO_REFERENCIA = "OPA"

    class Qualificacao(models.TextChoices):
        INICIAL = "inicial", "Inicial"
        COMPLETA = "completa", "Completa"

    entidade = models.ForeignKey(
        "entidades.Entidade", on_delete=models.PROTECT, related_name="oportunidades", verbose_name="proprietário"
    )
    # Imóvel já registado, OU descrição provisória enquanto o imóvel não é criado.
    imovel = models.ForeignKey(
        "imoveis.Imovel", null=True, blank=True, on_delete=models.PROTECT, related_name="oportunidades"
    )
    tipo_imovel = campo_lista("tipos_imovel", verbose_name="tipo de imóvel (provisório)")
    tipologia = campo_lista("tipologias", verbose_name="tipologia (provisória)")
    localidade = models.CharField("localidade (provisória)", max_length=100, blank=True)
    descricao_imovel = models.CharField("descrição do imóvel (provisória)", max_length=255, blank=True)

    operacao = campo_lista("operacoes", verbose_name="operação pretendida")
    estado = campo_lista("estados_oportunidade")
    qualificacao = models.CharField(max_length=10, choices=Qualificacao.choices, default=Qualificacao.INICIAL)
    origem = campo_lista("origens_contacto")
    motivacao = models.TextField("motivação do proprietário", blank=True)
    # NULL = ainda não indicado (diferente de zero).
    preco_pretendido = models.DecimalField(
        "preço pretendido", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    prazo = models.DateField("prazo pretendido", null=True, blank=True, help_text="Até quando pretende concretizar.")

    angariacao_gerada = models.ForeignKey(
        "angariacoes.Angariacao", null=True, blank=True, on_delete=models.PROTECT, related_name="+", editable=False
    )

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "oportunidade de angariação"
        verbose_name_plural = "oportunidades de angariação"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.referencia or f"Oportunidade {self.pk}"
