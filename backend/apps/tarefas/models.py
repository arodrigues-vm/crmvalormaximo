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

# Fichas a que uma tarefa geral se pode ligar (D-52): os oito módulos comerciais.
ORIGENS = [
    ("entidades", "Entidades"),
    ("imoveis", "Imóveis"),
    ("angariacoes", "Angariações (CMI)"),
    ("oportunidades", "Oportunidades de Angariação"),
    ("procuras", "Procuras e Qualificação"),
    ("visitas", "Visitas"),
    ("propostas", "Propostas"),
    ("transacoes", "Transações"),
]
MODULOS_MODELO = [("pos-venda", "Pós-Venda (transação concluída)"), *ORIGENS]


class ModeloTarefa(models.Model):
    """Tarefa-modelo configurável pelo Administrador, por módulo (D-50, D-52). No Pós-Venda o prazo conta da
    escritura / contrato; nos outros módulos, do dia em que a tarefa é criada."""

    modulo = models.CharField("módulo", max_length=30, choices=MODULOS_MODELO, default="pos-venda")
    nome = models.CharField(max_length=150)
    descricao = models.TextField("descrição", blank=True)
    dias_apos = models.PositiveIntegerField(
        "prazo (dias depois da escritura / contrato, ou da criação)", default=0, validators=[MaxValueValidator(3650)]
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
    motivo_estado = models.TextField("motivo da última mudança de estado", blank=True)
    # Tarefa geral ligada a uma ficha (opcional, D-52). O Pós-Venda usa o campo `transacao`.
    origem_modulo = models.CharField("ligada a (módulo)", max_length=30, choices=ORIGENS, blank=True)
    origem_id = models.PositiveBigIntegerField("ligada a (registo)", null=True, blank=True)
    transacao = models.ForeignKey(
        "transacoes.Transacao", null=True, blank=True, on_delete=models.PROTECT, related_name="tarefas"
    )
    # Ocorrência do Plano de Marketing de Imóveis (D-53): n.º e semana do catálogo; «Incluir» por checkbox.
    plano = models.ForeignKey(
        "marketing.PlanoMarketing", null=True, blank=True, on_delete=models.PROTECT, related_name="tarefas"
    )
    mk_numero = models.PositiveSmallIntegerField("n.º no catálogo", null=True, blank=True)
    mk_semana = models.PositiveSmallIntegerField("semana do plano", null=True, blank=True)
    incluida = models.BooleanField("incluída no plano", default=True)
    # Tarefa de um plano de Marketing de Entidades (D-55): inscrição e tarefa-modelo de origem.
    inscricao = models.ForeignKey(
        "marketing_entidades.Inscricao", null=True, blank=True, on_delete=models.PROTECT, related_name="tarefas"
    )
    passo = models.ForeignKey(
        "marketing_entidades.PassoPlano", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
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
        indexes = [
            models.Index(fields=["responsavel", "eliminado_em"]),
            models.Index(fields=["prazo"]),
            models.Index(fields=["origem_modulo", "origem_id"]),
        ]

    def __str__(self):
        return self.referencia or self.titulo

    @property
    def pos_venda(self) -> bool:
        return self.transacao_id is not None

    @property
    def marketing(self) -> bool:
        return self.plano_id is not None

    @property
    def marketing_entidades(self) -> bool:
        return self.inscricao_id is not None

    @property
    def modulo_permissoes(self) -> str:
        if self.marketing_entidades:
            return "marketing-entidades"
        if self.marketing:
            return "marketing-imoveis"
        return "pos-venda" if self.pos_venda else "tarefas"
