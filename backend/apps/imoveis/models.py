import re

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista, campo_lista_multipla
from apps.core.armazenamento import armazenamento_privado_fn
from apps.core.modelos_base import RegistoBase


def caminho_fotografia(instancia, nome):
    return f"imoveis/{instancia.pk or 'novo'}/{nome}"


def lugares_da_garagem(nome: str) -> int:
    """«Box 2 lugares» → 2; «Não» → 0; sem número → 1."""
    if nome.strip().lower() in ("não", "nao"):
        return 0
    numero = re.search(r"\d+", nome)
    return int(numero.group()) if numero else 1


AREA = {"max_digits": 10, "decimal_places": 2, "null": True, "blank": True, "validators": [MinValueValidator(0)]}


class Imovel(RegistoBase):
    PREFIXO_REFERENCIA = "IMO"

    # Classificação
    tipo = campo_lista("tipos_imovel", verbose_name="tipo de imóvel")
    tipologia = campo_lista("tipologias")
    estado_comercializacao = campo_lista("estados_comercializacao", verbose_name="estado de comercialização")
    # Listas configuráveis com categoria fixa (venda/arrendamento; ativo/inativo/arquivado).
    operacao = campo_lista("operacoes", verbose_name="operação")
    status = campo_lista("status_imovel", verbose_name="status")
    condicao_fisica = campo_lista("condicoes_fisicas", verbose_name="estado do imóvel")
    destino_imovel = campo_lista("destinos_imovel", verbose_name="destino do imóvel")
    ocupacao = campo_lista("ocupacoes_imovel", verbose_name="ocupação")
    situacao = campo_lista("situacoes_imovel", verbose_name="situação do imóvel")
    conservacao = campo_lista("conservacoes", verbose_name="conservação")
    acabamentos = campo_lista("acabamentos")
    habitavel = campo_lista("sim_nao", verbose_name="habitável")
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
    link_localizacao = models.URLField("link da localização", max_length=500, blank=True)
    link_site = models.URLField("link do site", max_length=500, blank=True)

    # Documentação (D-34)
    tipo_artigo = campo_lista("artigos_matriciais", verbose_name="tipo de artigo")
    certificado_numero = models.CharField("n.º do certificado energético", max_length=60, blank=True)
    licenca_construcao = models.CharField("licença de construção", max_length=120, blank=True)
    licenca_habitabilidade = models.CharField("licença de habitabilidade", max_length=120, blank=True)
    alvara_loteamento = models.CharField("alvará de loteamento", max_length=120, blank=True)
    artigo_matricial = models.CharField("artigo matricial", max_length=120, blank=True)
    descricao_registo_predial = models.CharField("descrição do registo predial", max_length=200, blank=True)

    # Áreas (m²)
    area_bruta_privativa = models.DecimalField("área bruta privativa", **AREA)
    area_bruta_dependente = models.DecimalField("área bruta dependente", **AREA)
    area_util = models.DecimalField("área útil", **AREA)
    area_terreno = models.DecimalField("área do lote", **AREA)
    area_coberta = models.DecimalField("área coberta", **AREA)
    area_descoberta = models.DecimalField("área descoberta", **AREA)
    area_construcao = models.DecimalField("área de construção", **AREA)
    fonte_areas = campo_lista("fontes_areas", verbose_name="fonte das áreas")
    conformidade_areas = models.TextField("conformidade de áreas", blank=True)

    # Características
    quartos = models.PositiveSmallIntegerField(null=True, blank=True)
    suites = models.PositiveSmallIntegerField("suites", null=True, blank=True)
    quartos_extra = models.PositiveSmallIntegerField("quartos +1", null=True, blank=True)
    salas = models.PositiveSmallIntegerField(null=True, blank=True)
    casas_banho = models.PositiveSmallIntegerField("WCs", null=True, blank=True)
    wcs_servico = models.PositiveSmallIntegerField("WCs de serviço", null=True, blank=True)
    marquises = models.PositiveSmallIntegerField("marquise", null=True, blank=True)
    lavandarias = models.PositiveSmallIntegerField("lavandaria", null=True, blank=True)
    outras_divisoes = models.CharField("outras divisões", max_length=200, blank=True)
    cozinha = campo_lista("cozinhas")
    arrumacao = campo_lista("classificacoes", verbose_name="arrumação")
    climatizacao = campo_lista("climatizacoes", verbose_name="climatização")
    caixilharia = campo_lista("caixilharias")
    piscina = campo_lista("piscinas")
    garagem = campo_lista("garagens")
    ano_construcao = models.PositiveSmallIntegerField(
        "ano de construção", null=True, blank=True, validators=[MinValueValidator(1000), MaxValueValidator(2200)]
    )
    piso = models.CharField(max_length=20, blank=True)
    # Elevadores: lista «Não, 1…10». O campo sim/não `elevador` é derivado (usado nas correspondências).
    elevadores = campo_lista("quantidades")
    elevador = models.BooleanField(null=True, blank=True, help_text="Vazio = desconhecido.")
    # D-35: deixa de se preencher à mão; é derivado da «Garagem» (n.º de lugares) para as correspondências.
    lugares_estacionamento = models.PositiveSmallIntegerField(null=True, blank=True)
    certificado_energetico = campo_lista("certificados_energeticos", verbose_name="classe energética")
    zonas_exteriores = campo_lista_multipla("zonas_exteriores")
    descricao = models.TextField("descrição", blank=True)

    # Uma única fotografia de identificação; as restantes ficam em pastas externas (ligações).
    fotografia = models.ImageField(upload_to=caminho_fotografia, blank=True, storage=armazenamento_privado_fn)
    fotografia_miniatura = models.ImageField(upload_to=caminho_fotografia, blank=True, storage=armazenamento_privado_fn)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)
    # D-35: nova comercialização do mesmo imóvel = novo registo, criado com «Duplicar imóvel».
    duplicado_de = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="duplicados", editable=False
    )

    historico = HistoricalRecords(excluded_fields=["fotografia_miniatura"])

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "imóvel"
        verbose_name_plural = "imóveis"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.referencia or f"Imóvel {self.pk}"

    def save(self, *args, **kwargs):
        if self.elevadores_id:
            self.elevador = self.elevadores.nome.strip().lower() not in ("não", "nao", "0")
        # Lugares de estacionamento = primeiro número do nome da garagem («Box 2 lugares» → 2; sem número → 1).
        self.lugares_estacionamento = lugares_da_garagem(self.garagem.nome) if self.garagem_id else None
        super().save(*args, **kwargs)


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
