from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista, campo_lista_multipla
from apps.core.modelos_base import RegistoBase

AREA = {"max_digits": 10, "decimal_places": 2, "null": True, "blank": True, "validators": [MinValueValidator(0)]}


class Imovel(RegistoBase):
    PREFIXO_REFERENCIA = "IMO"

    class Operacao(models.TextChoices):
        VENDA = "venda", "Venda"
        ARRENDAMENTO = "arrendamento", "Arrendamento"

    class Status(models.TextChoices):
        ATIVO = "ativo", "Ativo"
        INATIVO = "inativo", "Inativo"
        ARQUIVADO = "arquivado", "Arquivado"

    # Classificação
    tipo = campo_lista("tipos_imovel", verbose_name="tipo de imóvel")
    tipologia = campo_lista("tipologias")
    operacao = models.CharField("operação", max_length=12, choices=Operacao.choices, default=Operacao.VENDA)
    estado_comercializacao = campo_lista("estados_comercializacao", verbose_name="estado de comercialização")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ATIVO, db_index=True)
    condicao_fisica = campo_lista("condicoes_fisicas", verbose_name="condição física")
    # NULL = preço desconhecido (diferente de zero).
    preco = models.DecimalField(
        "preço", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )

    # Localização: administrativa (CAOP), comercial (zona) e descritiva.
    rua = models.CharField(max_length=200, blank=True)
    numero_policia = models.CharField("número de polícia", max_length=20, blank=True)
    complemento = models.CharField(max_length=100, blank=True)
    codigo_postal = models.CharField(max_length=8, blank=True)
    localidade = models.CharField(max_length=100, blank=True)
    freguesia = models.ForeignKey(
        "localizacao.Freguesia", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    zona_comercial = campo_lista("zonas_comerciais")
    localizacao_descritiva = models.CharField(
        "localização descritiva", max_length=200, blank=True, help_text="Ex.: junto ao parque da cidade."
    )

    # Áreas (m²)
    area_bruta_privativa = models.DecimalField("área bruta privativa", **AREA)
    area_bruta_dependente = models.DecimalField("área bruta dependente", **AREA)
    area_util = models.DecimalField("área útil", **AREA)
    area_terreno = models.DecimalField("área do terreno", **AREA)

    # Características
    quartos = models.PositiveSmallIntegerField(null=True, blank=True)
    casas_banho = models.PositiveSmallIntegerField("casas de banho", null=True, blank=True)
    ano_construcao = models.PositiveSmallIntegerField(
        "ano de construção", null=True, blank=True, validators=[MinValueValidator(1000), MaxValueValidator(2200)]
    )
    piso = models.CharField(max_length=20, blank=True)
    elevador = models.BooleanField(null=True, blank=True, help_text="Vazio = desconhecido.")
    lugares_estacionamento = models.PositiveSmallIntegerField(null=True, blank=True)
    certificado_energetico = campo_lista("certificados_energeticos", verbose_name="certificado energético")
    zonas_exteriores = campo_lista_multipla("zonas_exteriores")
    descricao = models.TextField("descrição", blank=True)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "imóvel"
        verbose_name_plural = "imóveis"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.referencia or f"Imóvel {self.pk}"


class Proprietario(models.Model):
    """Titularidade ATUAL. Os negócios guardam a sua própria fotografia dos participantes,
    pelo que alterar proprietários aqui não reescreve transações (Q16/AT-11)."""

    imovel = models.ForeignKey(Imovel, on_delete=models.CASCADE, related_name="proprietarios")
    entidade = models.ForeignKey("entidades.Entidade", on_delete=models.PROTECT, related_name="propriedades")
    # Percentagem (0–100). NULL = quota não indicada.
    quota = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    ordem = models.PositiveSmallIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["ordem", "id"]
        verbose_name = "proprietário"
        verbose_name_plural = "proprietários"
        constraints = [models.UniqueConstraint(fields=["imovel", "entidade"], name="proprietario_unico")]

    def __str__(self):
        return f"{self.entidade} ({self.quota or '?'}%)"
