"""Agenda e avisos (F4-02, Cap. 17, D-51).

- **Compromissos** próprios da Agenda (AGE-): início obrigatório, fim opcional, tipo, local, responsável,
  ligação opcional a uma entidade e/ou um imóvel; estados Agendado / Concluído / Cancelado, com cancelamento e
  reabertura expressos (motivo) e histórico.
- **Acontecimentos derivados** (visitas, tarefas de pós-venda, aniversários) **não** se copiam: lêem-se da origem
  em cada pedido (a origem é a fonte de verdade).
- **Avisos** internos calculados; guarda-se apenas quem já os dispensou.
"""

from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase


class Compromisso(RegistoBase):
    PREFIXO_REFERENCIA = "AGE"

    titulo = models.CharField("título", max_length=200)
    tipo = campo_lista("tipos_compromisso")
    inicio = models.DateTimeField("início")
    fim = models.DateTimeField(null=True, blank=True)
    local = models.CharField(max_length=255, blank=True)
    descricao = models.TextField("descrição", blank=True)
    estado = campo_lista("estados_compromisso")
    motivo_estado = models.TextField("motivo da última mudança de estado", blank=True)
    entidade = models.ForeignKey(
        "entidades.Entidade", null=True, blank=True, on_delete=models.PROTECT, related_name="compromissos"
    )
    imovel = models.ForeignKey(
        "imoveis.Imovel", null=True, blank=True, on_delete=models.PROTECT, related_name="compromissos",
        verbose_name="imóvel",
    )  # fmt: skip

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")

    historico = HistoricalRecords()

    class Meta:
        ordering = ["inicio", "id"]
        verbose_name = "compromisso"
        verbose_name_plural = "compromissos"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"]), models.Index(fields=["inicio"])]

    def __str__(self):
        return self.referencia or self.titulo


class AvisoDispensado(models.Model):
    """Aviso que o utilizador já viu e dispensou (os avisos em si são calculados)."""

    utilizador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    chave = models.CharField(max_length=80)
    em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["utilizador", "chave"], name="aviso_dispensado_unico")]

    def __str__(self):
        return self.chave
