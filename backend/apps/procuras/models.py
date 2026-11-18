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

    entidade = models.ForeignKey(
        "entidades.Entidade", on_delete=models.PROTECT, related_name="procuras", verbose_name="comprador / interessado"
    )
    # O que o CLIENTE pretende. Liga-se aos imóveis pela categoria da operação destes:
    # comprar → imóveis de categoria «venda»; arrendar → «arrendamento».
    pretende = models.CharField("o cliente pretende", max_length=12, choices=Pretende.choices, default=Pretende.COMPRAR)
    estado = campo_lista("estados_procura")
    urgencia = campo_lista("urgencias", verbose_name="urgência")

    # Qualificação do comprador (D-34). Prazos em texto: os clientes falam em prazos, não em datas.
    destino_imovel = campo_lista("destinos_imovel", verbose_name="destino do imóvel")
    nivel_motivacao = campo_lista("niveis_motivacao", verbose_name="motivação de compra")
    motivacao = models.TextField("motivo para comprar", blank=True)
    compra_depende_venda = campo_lista("sim_nao", verbose_name="a compra depende da venda")
    prazo_aquisicao = models.CharField("prazo de aquisição", max_length=120, blank=True)
    quando_iniciou = models.CharField("quando iniciou a procura", max_length=120, blank=True)
    o_que_quer = models.TextField("o que quer", blank=True)
    o_que_nao_quer = models.TextField("o que não quer", blank=True)
    flexibilidade = models.TextField(blank=True, help_text="Em que aspetos o cliente é flexível.")
    piso = models.CharField(max_length=120, blank=True, help_text="Ex.: não quer rés-do-chão.")
    exposicao_solar = models.CharField("exposição solar", max_length=120, blank=True)
    aceita_obras = campo_lista("aceita_obras", verbose_name="obras")

    # Pré-qualificação financeira
    plafond = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    modo_pagamento = campo_lista("modos_pagamento", verbose_name="modo de pagamento")
    capitais_proprios = campo_lista("sim_nao", verbose_name="capitais próprios")
    financiamento = campo_lista("sim_nao")
    qualificacao_bancaria = campo_lista("sim_nao", verbose_name="qualificação bancária")
    entidade_bancaria = campo_lista("entidades_bancarias", verbose_name="entidade bancária")
    observacoes_qualificacao = models.TextField("observações da qualificação", blank=True)

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
