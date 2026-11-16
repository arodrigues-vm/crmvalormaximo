"""Procuras e Qualificação: o que cada comprador/arrendatário procura.

Cada critério opcional tem uma importância: **obrigatório** (exclui imóveis que comprovadamente
não o cumprem) ou **preferencial** (só ordena e explica). O orçamento é sempre obrigatório, com
tolerância configurável de 0% a 20% (0% por omissão) — Especificação Cap. 9, Q15, AT-10."""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista, campo_lista_multipla
from apps.core.modelos_base import RegistoBase


class Importancia(models.TextChoices):
    OBRIGATORIO = "obrigatorio", "Obrigatório"
    PREFERENCIAL = "preferencial", "Preferencial"


def importancia(nome: str):
    return models.CharField(
        f"importância ({nome})", max_length=12, choices=Importancia.choices, default=Importancia.PREFERENCIAL
    )


def hoje():
    return timezone.localdate()


class Pretende(models.TextChoices):
    COMPRAR = "comprar", "Comprar"
    ARRENDAR = "arrendar", "Arrendar"


# Categoria da operação dos imóveis correspondente ao que o cliente pretende.
CATEGORIA_IMOVEL = {Pretende.COMPRAR: "venda", Pretende.ARRENDAR: "arrendamento"}
PRETENDE_POR_CATEGORIA = {v: k for k, v in CATEGORIA_IMOVEL.items()}


class Procura(RegistoBase):
    PREFIXO_REFERENCIA = "PRC"

    class Qualificacao(models.TextChoices):
        INICIAL = "inicial", "Inicial"
        COMPLETA = "completa", "Completa"

    entidade = models.ForeignKey(
        "entidades.Entidade", on_delete=models.PROTECT, related_name="procuras", verbose_name="comprador / interessado"
    )
    # O que o CLIENTE pretende. Liga-se aos imóveis pela categoria da operação destes:
    # comprar → imóveis de categoria «venda»; arrendar → «arrendamento».
    pretende = models.CharField("o cliente pretende", max_length=12, choices=Pretende.choices, default=Pretende.COMPRAR)
    estado = campo_lista("estados_procura")
    qualificacao = models.CharField(max_length=10, choices=Qualificacao.choices, default=Qualificacao.INICIAL)
    urgencia = campo_lista("urgencias", verbose_name="urgência")
    motivacao = models.TextField("motivação", blank=True)
    flexibilidade = models.TextField(blank=True, help_text="Em que aspetos o cliente é flexível.")
    prazo_compra = models.DateField("prazo para comprar/arrendar", null=True, blank=True)
    data_inicio = models.DateField("início da procura", default=hoje)

    # Orçamento: sempre obrigatório quando indicado. NULL = não indicado.
    orcamento_max = models.DecimalField(
        "orçamento máximo", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    tolerancia_pct = models.DecimalField(
        "tolerância (%)",
        max_digits=4,
        decimal_places=1,
        default=Decimal("0"),
        validators=[MinValueValidator(0), MaxValueValidator(20)],
    )

    # Critérios com importância
    tipos = campo_lista_multipla("tipos_imovel", verbose_name="tipos de imóvel aceites")
    imp_tipos = importancia("tipos")
    tipologias = campo_lista_multipla("tipologias")
    imp_tipologias = importancia("tipologias")
    # Localização: concelhos inteiros OU freguesias específicas OU zonas comerciais (basta uma).
    concelhos = models.ManyToManyField("localizacao.Concelho", blank=True, related_name="+")
    freguesias = models.ManyToManyField("localizacao.Freguesia", blank=True, related_name="+")
    zonas_comerciais = campo_lista_multipla("zonas_comerciais")
    imp_localizacao = importancia("localização")
    quartos_min = models.PositiveSmallIntegerField("quartos (mínimo)", null=True, blank=True)
    imp_quartos = importancia("quartos")
    area_min = models.DecimalField(
        "área mínima (m²)", max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    imp_area = importancia("área")
    zonas_exteriores = campo_lista_multipla("zonas_exteriores", verbose_name="zonas exteriores (todas)")
    imp_zonas_exteriores = importancia("zonas exteriores")
    exige_elevador = models.BooleanField("elevador", default=False)
    imp_elevador = importancia("elevador")
    estacionamento_min = models.PositiveSmallIntegerField("lugares de estacionamento (mínimo)", null=True, blank=True)
    imp_estacionamento = importancia("estacionamento")
    condicoes_fisicas = campo_lista_multipla("condicoes_fisicas", verbose_name="condições físicas aceites")
    imp_condicoes = importancia("condição física")

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "procura"
        verbose_name_plural = "procuras"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.referencia or f"Procura {self.pk}"

    @property
    def teto(self) -> Decimal | None:
        if self.orcamento_max is None:
            return None
        return (self.orcamento_max * (Decimal(100) + self.tolerancia_pct) / Decimal(100)).quantize(Decimal("0.01"))
