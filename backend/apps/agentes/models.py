"""Agências e Agentes (Especificação Cap. 26, F2-05).

Um Agente é um profissional imobiliário (da agência ou de fora) e NÃO é um utilizador com acesso à
aplicação; pode, opcionalmente, estar ligado à conta de um utilizador (consultor da agência).
"""

from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista
from apps.core.modelos_base import RegistoBase


class Agencia(RegistoBase):
    PREFIXO_REFERENCIA = "AGC"

    nome = models.CharField(max_length=150)
    tipo = campo_lista("tipos_agencia", verbose_name="tipo de agência")
    status = campo_lista("status_agentes")
    nif = models.CharField("NIF/NIPC", max_length=20, blank=True)
    licenca_ami = models.CharField("licença AMI", max_length=30, blank=True)
    nome_responsavel = models.CharField("responsável", max_length=150, blank=True)
    telefone_regiao = models.CharField(max_length=2, default="PT")
    telefone = models.CharField(max_length=30, blank=True)
    telefone_e164 = models.CharField(max_length=20, blank=True, editable=False)
    email = models.EmailField(blank=True)
    site = models.URLField(max_length=300, blank=True)
    rua = models.CharField(max_length=200, blank=True)
    numero_policia = models.CharField("número de polícia", max_length=20, blank=True)
    complemento = models.CharField(max_length=100, blank=True)
    codigo_postal = models.CharField(max_length=8, blank=True)
    localidade = models.CharField(max_length=100, blank=True)
    freguesia = models.ForeignKey(
        "localizacao.Freguesia", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["nome", "id"]
        verbose_name = "agência"
        verbose_name_plural = "agências"

    def __str__(self):
        return self.nome


class Agente(RegistoBase):
    PREFIXO_REFERENCIA = "AGT"

    nome = models.CharField(max_length=150)
    tipo = campo_lista("tipos_agente", verbose_name="tipo de agente")
    status = campo_lista("status_agentes")
    agencia = models.ForeignKey(
        Agencia, null=True, blank=True, on_delete=models.PROTECT, related_name="agentes", verbose_name="agência"
    )
    nif = models.CharField("NIF", max_length=20, blank=True)
    telefone_regiao = models.CharField(max_length=2, default="PT")
    telefone = models.CharField(max_length=30, blank=True)
    telefone_e164 = models.CharField(max_length=20, blank=True, editable=False)
    email = models.EmailField(blank=True)
    # Ligação opcional à conta de um utilizador (consultor da agência). Não dá nem tira acessos.
    utilizador = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="agente",
        verbose_name="utilizador da aplicação",
    )  # fmt: skip

    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    observacoes = models.TextField(blank=True)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["nome", "id"]
        verbose_name = "agente"
        verbose_name_plural = "agentes"

    def __str__(self):
        return self.nome
