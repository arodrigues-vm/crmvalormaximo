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
    url_anuncio = models.URLField("anúncio (site)", max_length=500, blank=True)

    operacao = campo_lista("operacoes", verbose_name="operação pretendida")
    estado = campo_lista("estados_oportunidade")
    origem = campo_lista("origens_contacto")
    # NULL = ainda não indicado (diferente de zero).
    preco_pretendido = models.DecimalField(
        "valor pretendido", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )

    # Qualificação do vendedor (D-34). Os prazos são texto: os clientes falam em prazos, não em datas.
    destino_imovel = campo_lista("destinos_imovel", verbose_name="destino do imóvel")
    ocupacao = campo_lista("ocupacoes_imovel", verbose_name="ocupação")
    nivel_motivacao = campo_lista("niveis_motivacao", verbose_name="motivação de venda")
    motivacao = models.TextField("motivo da venda", blank=True)
    venda_depende_compra = campo_lista("sim_nao", verbose_name="a venda depende da compra")
    prazo_vender = models.CharField("prazo para vender", max_length=120, blank=True)
    se_nao_vender = models.TextField("se não vender", blank=True)
    unico_proprietario = campo_lista("sim_nao", verbose_name="único proprietário")
    todos_de_acordo = campo_lista("sim_nao", verbose_name="todos de acordo com a venda")
    quando_comprou = models.CharField("quando comprou o imóvel", max_length=120, blank=True)
    valor_compra = models.DecimalField(
        "valor de compra", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    valor_hipoteca = models.DecimalField(
        "hipoteca associada", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    entidade_bancaria = campo_lista("entidades_bancarias", verbose_name="entidade bancária")
    como_chegou_valor = models.TextField("como chegou a esse valor", blank=True)
    esta_a_venda = campo_lista("sim_nao", verbose_name="está à venda")
    tempo_a_venda = models.CharField("há quanto tempo", max_length=120, blank=True)
    teve_visitas = campo_lista("sim_nao", verbose_name="teve visitas")
    teve_propostas = campo_lista("sim_nao", verbose_name="teve propostas")
    valor_proposta = models.DecimalField(
        "valor da proposta", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    porque_nao_aceitou = models.TextField("porque não aceitou", blank=True)
    pontos_positivos = models.TextField("pontos positivos", blank=True)
    objecoes = models.TextField("objeções", blank=True)

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
