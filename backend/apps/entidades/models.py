from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.modelos_base import RegistoBase


class PapelEntidade(models.Model):
    """Papéis comerciais configuráveis (proprietário, comprador, …)."""

    nome = models.CharField(max_length=60, unique=True)
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordem", "nome"]
        verbose_name = "papel de entidade"
        verbose_name_plural = "papéis de entidade"

    def __str__(self):
        return self.nome


class OrigemContacto(models.Model):
    """Origem do contacto (configurável pelo Administrador; nenhuma vem instalada)."""

    nome = models.CharField(max_length=80, unique=True)
    ativa = models.BooleanField(default=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "origem de contacto"
        verbose_name_plural = "origens de contacto"

    def __str__(self):
        return self.nome


class Entidade(RegistoBase):
    PREFIXO_REFERENCIA = "ENT"

    class TipoPessoa(models.TextChoices):
        SINGULAR = "singular", "Pessoa singular"
        COLETIVA = "coletiva", "Pessoa coletiva"

    class Consentimento(models.TextChoices):
        DESCONHECIDO = "desconhecido", "Desconhecido / não recolhido"
        CONCEDIDO = "concedido", "Concedido"
        RECUSADO = "recusado", "Recusado"

    tipo_pessoa = models.CharField(max_length=10, choices=TipoPessoa.choices, default=TipoPessoa.SINGULAR)
    nome = models.CharField(max_length=150, help_text="Nome próprio ou denominação social.")
    apelido = models.CharField(max_length=150, blank=True)
    nome_completo = models.CharField(max_length=301, editable=False, db_index=True)

    pais_fiscal = models.CharField("país fiscal", max_length=2, default="PT")
    nif = models.CharField("NIF/NIPC", max_length=20, blank=True, db_index=True)
    data_nascimento = models.DateField(null=True, blank=True)

    email = models.EmailField(blank=True, db_index=True)

    # Morada (formulário simplificado FT-01)
    rua = models.CharField(max_length=200, blank=True)
    numero_policia = models.CharField("número de polícia", max_length=20, blank=True)
    complemento = models.CharField(max_length=100, blank=True, help_text="Andar, fração, lote…")
    codigo_postal = models.CharField(max_length=8, blank=True)
    localidade = models.CharField(max_length=100, blank=True)
    freguesia = models.ForeignKey(
        "localizacao.Freguesia", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    papeis = models.ManyToManyField(PapelEntidade, blank=True, related_name="entidades")
    origem = models.ForeignKey(OrigemContacto, null=True, blank=True, on_delete=models.PROTECT)
    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    ativa = models.BooleanField(default=True)
    observacoes = models.TextField(blank=True)

    # Proteção de dados (RGPD): importação ou criação não implica consentimento.
    consentimento_marketing = models.CharField(
        max_length=12, choices=Consentimento.choices, default=Consentimento.DESCONHECIDO
    )
    consentimento_marketing_em = models.DateField(null=True, blank=True)
    oposicao_marketing = models.BooleanField(
        "oposição a marketing", default=False, help_text="Prevalece sobre qualquer consentimento."
    )

    historico = HistoricalRecords(excluded_fields=["nome_completo"])

    class Meta:
        ordering = ["nome_completo", "id"]
        verbose_name = "entidade"
        verbose_name_plural = "entidades"
        indexes = [models.Index(fields=["responsavel", "eliminado_em"])]

    def __str__(self):
        return self.nome_completo

    def save(self, *args, **kwargs):
        partes = [self.nome.strip()]
        if self.tipo_pessoa == self.TipoPessoa.SINGULAR and self.apelido.strip():
            partes.append(self.apelido.strip())
        self.nome_completo = " ".join(partes)
        self.nif = "".join(self.nif.split()).upper()
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)


class TelefoneEntidade(models.Model):
    class Tipo(models.TextChoices):
        MOVEL = "movel", "Telemóvel"
        FIXO = "fixo", "Fixo"
        TRABALHO = "trabalho", "Trabalho"
        OUTRO = "outro", "Outro"

    entidade = models.ForeignKey(Entidade, on_delete=models.CASCADE, related_name="telefones")
    regiao = models.CharField("país", max_length=2, default="PT")
    numero = models.CharField(max_length=30, help_text="Como foi introduzido.")
    numero_e164 = models.CharField(max_length=20, db_index=True)
    extensao = models.CharField(max_length=10, blank=True, help_text="Preservada; não pedida no formulário.")
    tipo = models.CharField(max_length=10, choices=Tipo.choices, default=Tipo.MOVEL)
    principal = models.BooleanField(default=False)
    ordem = models.PositiveSmallIntegerField(default=0)

    historico = HistoricalRecords()

    class Meta:
        ordering = ["-principal", "ordem", "id"]
        verbose_name = "telefone"
        verbose_name_plural = "telefones"

    def __str__(self):
        return self.numero_e164
