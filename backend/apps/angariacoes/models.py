"""Angariações — Contratos de Mediação Imobiliária (CMI).

Regras principais (Especificação Cap. 7, D-02, AT-04):
- A data de início original do CMI assinado é estável: só muda por *correção material*
  (motivo, evidência, permissão própria e auditoria).
- Cada renovação é um evento autónomo, com data de início própria; os ciclos anteriores
  ficam preservados. A data de fim em vigor é a da última renovação.
- Não são permitidos contratos sobrepostos no mesmo imóvel quando algum é exclusivo.
"""

from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase


def calcular_fim(inicio: date, prazo_meses: int) -> date:
    """Fim = início + prazo (meses) − 1 dia. Ex.: 01/01 + 6 meses → 30/06.
    Convenção a confirmar pelo proprietário (ver DECISOES)."""
    return inicio + relativedelta(months=prazo_meses) - timedelta(days=1)


class Angariacao(RegistoBase):
    PREFIXO_REFERENCIA = "CMI"

    class Situacao(models.TextChoices):
        EM_CURSO = "em_curso", "Em curso"
        CONCLUIDA = "concluida", "Concluída (negócio realizado)"
        CANCELADA = "cancelada", "Cancelada / revogada"

    class Modalidade(models.TextChoices):
        PERCENTAGEM = "percentagem", "Percentagem sobre o valor do negócio"
        VALOR_FIXO = "valor_fixo", "Valor fixo"
        NUMERO_RENDAS = "numero_rendas", "Número de rendas"
        PERCENTAGEM_BASE = "percentagem_base", "Percentagem sobre base contratual"

    # Modalidades permitidas por categoria de operação (Cap. 13: venda e arrendamento).
    MODALIDADES_POR_OPERACAO = {
        "venda": {Modalidade.PERCENTAGEM, Modalidade.VALOR_FIXO},
        "arrendamento": {Modalidade.NUMERO_RENDAS, Modalidade.VALOR_FIXO, Modalidade.PERCENTAGEM_BASE},
    }

    imovel = models.ForeignKey("imoveis.Imovel", on_delete=models.PROTECT, related_name="angariacoes")
    numero_contrato = models.CharField("número do contrato", max_length=60, blank=True)
    operacao = campo_lista("operacoes", verbose_name="tipo (operação)")
    regime = campo_lista("regimes_cmi")

    # D-34: sem «data de assinatura». O CMI conta como assinado quando tem data de início e prazo.
    # Início ORIGINAL: estável depois da assinatura (só por correção material).
    data_inicio = models.DateField("data de início", null=True, blank=True)
    prazo_meses = models.PositiveSmallIntegerField(
        "prazo (meses)", null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(120)]
    )
    data_fim = models.DateField("data de fim (ciclo inicial)", null=True, blank=True, editable=False)
    # Fim em vigor = fim do último ciclo (inicial ou renovação). Guardado para pesquisas e avisos.
    data_fim_vigente = models.DateField(null=True, blank=True, editable=False, db_index=True)

    # Acompanhamento comercial (D-34, Excel «Imoveis»)
    prioridade = campo_lista("prioridades")
    comercializacao_prevista = campo_lista("comercializacao_prevista", verbose_name="comercialização")
    valor_acm = models.DecimalField(
        "valor ACM", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)],
        help_text="Valor da análise comparativa de mercado.",
    )  # fmt: skip
    valor_vendido = models.DecimalField(
        "valor vendido", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    observacoes_angariacao = models.TextField("observações da angariação", blank=True)

    situacao = models.CharField(max_length=12, choices=Situacao.choices, default=Situacao.EM_CURSO, db_index=True)
    situacao_motivo = models.CharField(max_length=255, blank=True)

    # Remuneração
    modalidade_remuneracao = models.CharField(max_length=20, choices=Modalidade.choices, blank=True)
    # Percentagem, euros ou número de rendas, conforme a modalidade. NULL = não indicado.
    valor_remuneracao = models.DecimalField(
        max_digits=12, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    base_contratual = models.CharField(
        max_length=200, blank=True, help_text="Obrigatória na modalidade «percentagem sobre base contratual»."
    )
    valor_minimo_remuneracao = models.DecimalField(
        "remuneração mínima (€)",
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    taxa_iva = models.DecimalField(
        "taxa de IVA (%)",
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    remuneracao_inclui_iva = models.BooleanField(
        "valores com IVA incluído", null=True, blank=True, help_text="Vazio = não indicado."
    )
    # Pagamento da comissão (D-34): o momento depende do sinal pago pelo comprador.
    # Ex.: «100% no CPCV» desde que o sinal seja de pelo menos 15%.
    momento_pagamento = campo_lista("momentos_pagamento_comissao", verbose_name="momento do pagamento")
    sinal_valor = models.DecimalField(
        "sinal mínimo", max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    sinal_unidade = models.CharField(
        "unidade do sinal",
        max_length=12,
        blank=True,
        choices=[("percentagem", "% do preço"), ("euros", "€")],
    )
    condicoes_pagamento = models.TextField("outras condições de pagamento", blank=True)

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name = "angariação (CMI)"
        verbose_name_plural = "angariações (CMI)"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.referencia or f"CMI {self.pk}"

    @property
    def assinado(self) -> bool:
        return self.data_inicio is not None and self.prazo_meses is not None

    def recalcular_datas(self):
        self.data_fim = (
            calcular_fim(self.data_inicio, self.prazo_meses) if self.data_inicio and self.prazo_meses else None
        )
        ultima = self.renovacoes.order_by("-ciclo").first() if self.pk else None
        self.data_fim_vigente = ultima.data_fim if ultima else self.data_fim

    def periodo(self) -> tuple[date, date] | None:
        if not self.data_inicio or not self.data_fim_vigente:
            return None
        return self.data_inicio, self.data_fim_vigente

    def estado(self, hoje: date) -> str:
        """Estado apresentado (derivado): por_assinar, ativa, renovada, expirada, concluida, cancelada."""
        if self.situacao == self.Situacao.CONCLUIDA:
            return "concluida"
        if self.situacao == self.Situacao.CANCELADA:
            return "cancelada"
        if not self.assinado:
            return "por_assinar"
        if self.data_fim_vigente and hoje > self.data_fim_vigente:
            return "expirada"
        if self.data_inicio and hoje < self.data_inicio:
            return "por_iniciar"
        # «Renovada» só a partir do momento em que o ciclo inicial terminou e vigora uma renovação.
        return "renovada" if self.data_fim and hoje > self.data_fim else "ativa"


ESTADOS = {
    "por_assinar": "Por assinar",
    "por_iniciar": "Assinada (por iniciar)",
    "ativa": "Ativa",
    "renovada": "Ativa (renovada)",
    "expirada": "Expirada",
    "concluida": "Concluída",
    "cancelada": "Cancelada",
}


class Interveniente(models.Model):
    """Partes do contrato. Fotografia própria: alterações posteriores aos proprietários do
    imóvel não alteram as partes de um CMI já registado."""

    angariacao = models.ForeignKey(Angariacao, on_delete=models.CASCADE, related_name="intervenientes")
    entidade = models.ForeignKey("entidades.Entidade", on_delete=models.PROTECT, related_name="+")
    papel = campo_lista("papeis_interveniente_cmi")
    quota = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    ordem = models.PositiveSmallIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["ordem", "id"]
        verbose_name = "interveniente"
        verbose_name_plural = "intervenientes"
        constraints = [models.UniqueConstraint(fields=["angariacao", "entidade"], name="interveniente_unico")]

    def __str__(self):
        return str(self.entidade)


class Renovacao(models.Model):
    """Renovação do CMI: evento autónomo com data de início própria (novo ciclo)."""

    class Forma(models.TextChoices):
        AUTOMATICA = "automatica", "Automática (prevista no contrato)"
        DOCUMENTO = "documento", "Formalizada por documento"

    angariacao = models.ForeignKey(Angariacao, on_delete=models.PROTECT, related_name="renovacoes")
    ciclo = models.PositiveSmallIntegerField(help_text="2 = primeira renovação (o contrato inicial é o ciclo 1).")
    forma = models.CharField(max_length=12, choices=Forma.choices)
    data_inicio = models.DateField("data de início da renovação")
    prazo_meses = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(120)])
    data_fim = models.DateField(editable=False)
    observacoes = models.CharField(max_length=255, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+")

    historico = HistoricalRecords()

    class Meta:
        ordering = ["angariacao", "ciclo"]
        verbose_name = "renovação"
        verbose_name_plural = "renovações"
        constraints = [models.UniqueConstraint(fields=["angariacao", "ciclo"], name="renovacao_ciclo_unico")]

    def __str__(self):
        return f"{self.angariacao} — ciclo {self.ciclo}"

    def save(self, *args, **kwargs):
        self.data_fim = calcular_fim(self.data_inicio, self.prazo_meses)
        super().save(*args, **kwargs)


class CorrecaoMaterial(models.Model):
    """Registo de uma correção excecional de dados contratuais (erro de registo)."""

    angariacao = models.ForeignKey(Angariacao, on_delete=models.PROTECT, related_name="correcoes")
    campo = models.CharField(max_length=40)
    valor_anterior = models.CharField(max_length=100)
    valor_novo = models.CharField(max_length=100)
    motivo = models.CharField(max_length=500)
    evidencia = models.CharField(
        "evidência", max_length=1000, help_text="Descrição ou ligação para o documento que comprova o erro."
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "correção material"
        verbose_name_plural = "correções materiais"

    def __str__(self):
        return f"{self.angariacao}: {self.campo}"
