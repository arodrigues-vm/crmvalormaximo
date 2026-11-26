"""Tarefas (base do F4-01) e Pós-Venda (F3-09, Cap. 15, D-50).

- Uma tarefa tem título, descrição, estado, prioridade, prazo, responsável, notas (diário) e histórico.
- **Pós-venda**: tarefa ligada obrigatoriamente a uma **transação concluída** (escritura / contrato).
- **Modelos de tarefa** configuráveis (nome, descrição, dias depois da escritura): ao concluir a transação, o CRM
  propõe-nos e cria só os confirmados. Reabrir ou cancelar a transação **não** altera as tarefas.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase


class ModeloTarefa(models.Model):
    """Tarefa-modelo de pós-venda, configurável pelo Administrador."""

    nome = models.CharField(max_length=150)
    descricao = models.TextField("descrição", blank=True)
    dias_apos = models.PositiveIntegerField(
        "prazo (dias depois da escritura / contrato)", default=0, validators=[MaxValueValidator(3650)]
    )
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["ordem", "id"]
        verbose_name = "modelo de tarefa"
        verbose_name_plural = "modelos de tarefa"

    def __str__(self):
        return self.nome


class Tarefa(RegistoBase):
    PREFIXO_REFERENCIA = "TAR"

    titulo = models.CharField("título", max_length=200)
    descricao = models.TextField("descrição", blank=True)
    categoria = campo_lista("categorias_tarefa")
    estado = campo_lista("estados_tarefa")
    prioridade = campo_lista("prioridades")
    prazo = models.DateField(null=True, blank=True)
    concluida_em = models.DateTimeField(null=True, blank=True, editable=False)
    transacao = models.ForeignKey(
        "transacoes.Transacao", null=True, blank=True, on_delete=models.PROTECT, related_name="tarefas"
    )
    modelo = models.ForeignKey(
        ModeloTarefa, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
        verbose_name="criada a partir do modelo",
    )  # fmt: skip

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")

    historico = HistoricalRecords()

    class Meta:
        ordering = ["prazo", "id"]
        verbose_name = "tarefa"
        verbose_name_plural = "tarefas"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"]), models.Index(fields=["prazo"])]

    def __str__(self):
        return self.referencia or self.titulo
