from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.configuracao.models import campo_lista, campo_lista_multipla
from apps.core.modelos_base import RegistoBase


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
    # Dados pessoais (D-34)
    estado_civil = campo_lista("estados_civis", verbose_name="estado civil")
    regime_casamento = campo_lista("regimes_casamento", verbose_name="regime de casamento")
    nacionalidade = models.CharField(max_length=60, blank=True)
    documento_identificacao = models.CharField("CC/Passaporte", max_length=30, blank=True)
    naturalidade_freguesia = models.CharField("freguesia de naturalidade", max_length=100, blank=True)
    naturalidade_concelho = models.CharField("concelho de naturalidade", max_length=100, blank=True)
    empresa = models.CharField(max_length=150, blank=True)
    cargo = models.CharField(max_length=100, blank=True)
    observacoes_pessoais = models.TextField("observações (dados pessoais)", blank=True)

    email = models.EmailField(blank=True, db_index=True)

    # Morada (formulário simplificado FT-01)
    rua = models.CharField(max_length=200, blank=True)
    numero_policia = models.CharField("número de polícia", max_length=20, blank=True)
    complemento = models.CharField(max_length=100, blank=True, help_text="Andar, fração, lote…")
    codigo_postal = models.CharField(max_length=8, blank=True)
    localidade = models.CharField(max_length=100, blank=True)
    zona_comercial = campo_lista("zonas_comerciais", verbose_name="zona")
    freguesia = models.ForeignKey(
        "localizacao.Freguesia", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    # «Tipo de cliente» (antes «Papéis»): Proprietário, Comprador… (D-34).
    papeis = campo_lista_multipla("papeis_entidade", verbose_name="tipo de cliente")
    origem = campo_lista("origens_contacto", verbose_name="origem do contacto")
    quem_recomendou = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="+", verbose_name="quem recomendou"
    )
    # Imóvel pelo qual o contacto chegou (angariado ou não) e se o visitou.
    imovel_contacto = models.ForeignKey(
        "imoveis.Imovel", null=True, blank=True, on_delete=models.PROTECT, related_name="+",
        verbose_name="imóvel de contacto",
    )  # fmt: skip
    visitou_imovel_contacto = models.BooleanField("visitou o imóvel de contacto", null=True, blank=True)
    motivo_nao_visitou = models.TextField("porque não visitou", blank=True)
    responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    partilhada_com = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="+")
    status = campo_lista("status_entidade")
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


class TipoRelacao(models.Model):
    """Tipo de relação entre entidades, configurável (ex.: Cônjuge, Gerente de / Tem como gerente).

    `nome` lê-se da origem para o destino; `nome_inverso` do destino para a origem.
    Nas relações simétricas (ex.: Cônjuge) os dois nomes são iguais.
    """

    nome = models.CharField(max_length=60, unique=True)
    nome_inverso = models.CharField(max_length=60)
    simetrica = models.BooleanField(default=False)
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["ordem", "nome"]
        verbose_name = "tipo de relação"
        verbose_name_plural = "tipos de relação"

    def __str__(self):
        return self.nome if self.simetrica else f"{self.nome} / {self.nome_inverso}"

    def save(self, *args, **kwargs):
        if self.simetrica:
            self.nome_inverso = self.nome
        super().save(*args, **kwargs)


class RelacaoEntidade(models.Model):
    origem = models.ForeignKey(Entidade, on_delete=models.PROTECT, related_name="relacoes_origem")
    destino = models.ForeignKey(Entidade, on_delete=models.PROTECT, related_name="relacoes_destino")
    tipo = models.ForeignKey(TipoRelacao, on_delete=models.PROTECT, related_name="+")
    observacoes = models.CharField(max_length=255, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+")

    historico = HistoricalRecords()

    class Meta:
        ordering = ["tipo__ordem", "id"]
        verbose_name = "relação entre entidades"
        verbose_name_plural = "relações entre entidades"
        constraints = [
            models.UniqueConstraint(fields=["origem", "destino", "tipo"], name="relacao_unica"),
            models.CheckConstraint(condition=~models.Q(origem=models.F("destino")), name="relacao_sem_propria"),
        ]

    def __str__(self):
        return f"{self.origem} — {self.tipo.nome} — {self.destino}"
