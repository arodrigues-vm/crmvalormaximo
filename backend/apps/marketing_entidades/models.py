"""Marketing de Entidades (F4-05, Cap. 20, D-04, D-55).

Só o **motor**: o CRM nasce sem planos, tarefas, públicos ou campanhas. O Administrador configura planos (objetivo,
público por critérios, fundamento RGPD, gatilhos) e as suas tarefas (prazo relativo, periodicidade, responsável).

- Uma entidade entra num plano por **inscrição** (à mão, para o público ou por gatilho ligado no plano).
- Cada tarefa gerada é uma tarefa central (`tarefas.Tarefa`), ligada à entidade: a mesma em Entidades, Tarefas e
  Agenda.
- RGPD: a oposição a marketing exclui sempre; com fundamento «consentimento», só com consentimento concedido.
  Nada é presumido.
"""

from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.modelos_base import RegistoBase


class PlanoEntidades(models.Model):
    class Fundamento(models.TextChoices):
        CONSENTIMENTO = "consentimento", "Consentimento (só entidades com consentimento concedido)"
        INTERESSE = "interesse_legitimo", "Interesse legítimo / relação contratual (todas, exceto oposição)"

    GATILHOS = [
        ("entidade_criada", "Entidade criada"),
        ("contacto_registado", "Contacto registado"),
        ("visita_realizada", "Visita realizada"),
        ("negocio_concluido", "Negócio concluído"),
    ]

    nome = models.CharField(max_length=150)
    descricao = models.TextField("descrição", blank=True)
    objetivo = models.TextField(blank=True)
    fundamento = models.CharField(max_length=20, choices=Fundamento.choices)
    # Público: {"papeis": [ids], "status": [ids], "origens": [ids], "zonas": [ids], "concelhos": [ids]}
    criterios = models.JSONField(default=dict, blank=True)
    gatilhos = models.JSONField(default=list, blank=True)
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["ordem", "id"]
        verbose_name = "plano de marketing de entidades"
        verbose_name_plural = "planos de marketing de entidades"

    def __str__(self):
        return self.nome


class PassoPlano(models.Model):
    """Tarefa-modelo de um plano: prazo relativo ao início da inscrição e periodicidade opcional."""

    plano = models.ForeignKey(PlanoEntidades, on_delete=models.PROTECT, related_name="passos")
    nome = models.CharField(max_length=150)
    descricao = models.TextField("descrição", blank=True)
    dias = models.PositiveIntegerField("prazo (dias depois do início)", default=0)
    periodicidade_dias = models.PositiveIntegerField("repetir de N em N dias", null=True, blank=True)
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+",
        help_text="Vazio = o responsável da entidade.",
    )  # fmt: skip
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["plano", "ordem", "id"]
        verbose_name = "tarefa do plano"
        verbose_name_plural = "tarefas do plano"

    def __str__(self):
        return f"{self.plano} · {self.nome}"


class Inscricao(RegistoBase):
    """Entidade num plano (um ciclo de execução)."""

    PREFIXO_REFERENCIA = "MKE"

    class Estado(models.TextChoices):
        ATIVA = "ativa", "Ativa"
        TERMINADA = "terminada", "Terminada"

    entidade = models.ForeignKey("entidades.Entidade", on_delete=models.PROTECT, related_name="inscricoes_marketing")
    plano = models.ForeignKey(PlanoEntidades, on_delete=models.PROTECT, related_name="inscricoes")
    inicio = models.DateField("início")
    origem = models.CharField(max_length=30, help_text="manual, publico ou o gatilho que a iniciou")
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ATIVA)
    terminada_em = models.DateTimeField(null=True, blank=True)
    motivo_fim = models.TextField(blank=True)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-inicio", "-id"]
        verbose_name = "inscrição em plano de marketing"
        verbose_name_plural = "inscrições em planos de marketing"
        constraints = [
            models.UniqueConstraint(
                fields=["entidade", "plano"],
                condition=models.Q(estado="ativa", eliminado_em__isnull=True),
                name="uma_inscricao_ativa_por_plano",
            )
        ]

    def __str__(self):
        return self.referencia or f"{self.entidade} · {self.plano}"
