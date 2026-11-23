"""Visitas e Interesses (Especificação Cap. 10, F3-03).

- Visita: imóvel, comprador, acompanhantes, consultor, data, horas, estado e a avaliação da ficha de
  visita (D-36). Reagendar = mudar a data de uma visita agendada (fica no histórico).
- Interesse: um comprador num imóvel (um só registo por par), com origem, grau, estado e acompanhamentos.
  É criado/atualizado automaticamente quando se regista uma visita e também pode ser criado à mão.
"""

from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase

# Critérios da ficha de visita (escala configurável «Avaliações da visita»: Muito mau … Muito bom).
CRITERIOS_AVALIACAO = {
    "av_localizacao": "Localização / zona",
    "av_infraestruturas": "Infraestruturas / serviços",
    "av_construcao": "Qualidade de construção",
    "av_acabamentos": "Acabamentos",
    "av_areas": "Áreas",
    "av_planta": "Planta do imóvel",
    "av_vista": "Vista",
    "av_estacionamento": "Estacionamento",
    "av_preco": "Preço",
}


class Visita(RegistoBase):
    PREFIXO_REFERENCIA = "VIS"

    imovel = models.ForeignKey("imoveis.Imovel", on_delete=models.PROTECT, related_name="visitas")
    entidade = models.ForeignKey(
        "entidades.Entidade", on_delete=models.PROTECT, related_name="visitas", verbose_name="cliente"
    )
    acompanhantes = models.ManyToManyField("entidades.Entidade", blank=True, related_name="+")
    procura = models.ForeignKey(
        "procuras.Procura", null=True, blank=True, on_delete=models.PROTECT, related_name="visitas"
    )
    data = models.DateField("data da visita")
    hora_entrada = models.TimeField("hora de entrada", null=True, blank=True)
    hora_saida = models.TimeField("hora de saída", null=True, blank=True)
    estado = campo_lista("estados_visita")

    # Avaliação (ficha de visita)
    av_localizacao = campo_lista("avaliacoes_visita", verbose_name="localização / zona")
    av_infraestruturas = campo_lista("avaliacoes_visita", verbose_name="infraestruturas / serviços")
    av_construcao = campo_lista("avaliacoes_visita", verbose_name="qualidade de construção")
    av_acabamentos = campo_lista("avaliacoes_visita", verbose_name="acabamentos")
    av_areas = campo_lista("avaliacoes_visita", verbose_name="áreas")
    av_planta = campo_lista("avaliacoes_visita", verbose_name="planta do imóvel")
    av_vista = campo_lista("avaliacoes_visita", verbose_name="vista")
    av_estacionamento = campo_lista("avaliacoes_visita", verbose_name="estacionamento")
    av_preco = campo_lista("avaliacoes_visita", verbose_name="preço")
    mais_gostou = models.TextField("o que mais gostou", blank=True)
    menos_gostou = models.TextField("o que menos gostou", blank=True)
    compraria = campo_lista("sim_nao", verbose_name="compraria este imóvel")

    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", verbose_name="consultor"
    )
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-data", "-hora_entrada", "-id"]
        verbose_name = "visita"
        verbose_name_plural = "visitas"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"]), models.Index(fields=["data"])]

    def __str__(self):
        return self.referencia or f"Visita {self.pk}"


class Interesse(RegistoBase):
    PREFIXO_REFERENCIA = "INT"

    entidade = models.ForeignKey(
        "entidades.Entidade", on_delete=models.PROTECT, related_name="interesses", verbose_name="cliente"
    )
    imovel = models.ForeignKey("imoveis.Imovel", on_delete=models.PROTECT, related_name="interesses")
    origem = campo_lista("origens_interesse")
    grau = campo_lista("graus_interesse", verbose_name="grau de interesse")
    estado = campo_lista("estados_interesse")
    ultima_visita = models.DateField("última visita", null=True, blank=True, editable=False)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-atualizado_em", "-id"]
        verbose_name = "interesse"
        verbose_name_plural = "interesses"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]
        constraints = [
            models.UniqueConstraint(
                fields=["entidade", "imovel"],
                condition=models.Q(eliminado_em__isnull=True),
                name="interesse_unico_por_cliente_e_imovel",
            )
        ]

    def __str__(self):
        return self.referencia or f"Interesse {self.pk}"
