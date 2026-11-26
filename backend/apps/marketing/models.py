"""Plano de Marketing de Imóveis (F4-03, Cap. 18, D-53).

- Um plano por ciclo de CMI assinado, criado só por ação expressa («Criar plano inicial»), a partir do catálogo
  original de 45 ocorrências em 8 semanas. Data-base: início original do CMI; prazos +0…+49 dias.
- Cada ocorrência é uma **tarefa** (`tarefas.Tarefa` com `plano`): a mesma no Plano, no menu Tarefas e na Agenda.
- Recalcular os prazos das pendentes após correção da data-base exige pedido e aprovação de outra pessoa
  (Responsável de Equipa ou Administrador); as concluídas não mudam.
"""

from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.modelos_base import RegistoBase


class PlanoMarketing(RegistoBase):
    PREFIXO_REFERENCIA = "PMK"

    imovel = models.ForeignKey("imoveis.Imovel", on_delete=models.PROTECT, related_name="planos_marketing")
    angariacao = models.ForeignKey(
        "angariacoes.Angariacao", on_delete=models.PROTECT, related_name="planos_marketing", verbose_name="CMI"
    )
    ciclo = models.PositiveSmallIntegerField(default=1)
    data_base = models.DateField("data-base (início do CMI)")
    ativo = models.BooleanField(default=True)
    observacoes = models.TextField(blank=True)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "plano de marketing"
        verbose_name_plural = "planos de marketing"
        constraints = [
            models.UniqueConstraint(
                fields=["angariacao", "ciclo"], condition=models.Q(eliminado_em__isnull=True), name="plano_por_ciclo"
            )
        ]

    def __str__(self):
        return self.referencia or f"Plano {self.pk}"


class PedidoRecalculo(models.Model):
    class Estado(models.TextChoices):
        PENDENTE = "pendente", "Pendente"
        APROVADO = "aprovado", "Aprovado"
        RECUSADO = "recusado", "Recusado"

    plano = models.ForeignKey(PlanoMarketing, on_delete=models.PROTECT, related_name="pedidos_recalculo")
    data_base_anterior = models.DateField()
    data_base_nova = models.DateField()
    motivo = models.TextField()
    pedido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    pedido_em = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDENTE)
    decidido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    decidido_em = models.DateTimeField(null=True, blank=True)
    motivo_decisao = models.TextField(blank=True)

    class Meta:
        ordering = ["-pedido_em", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["plano"], condition=models.Q(estado="pendente"), name="um_pedido_recalculo_pendente"
            )
        ]

    def __str__(self):
        return f"{self.plano} · {self.data_base_anterior} → {self.data_base_nova}"
