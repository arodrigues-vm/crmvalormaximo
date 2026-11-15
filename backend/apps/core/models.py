from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db import models


class RegistoAuditoria(models.Model):
    """Registo imutável de operações relevantes (Especificação §35, §38)."""

    momento = models.DateTimeField(auto_now_add=True, db_index=True)
    utilizador = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    acao = models.CharField(max_length=60, db_index=True)
    modulo = models.CharField(max_length=40, blank=True, db_index=True)
    objeto_tipo = models.CharField(max_length=60, blank=True)
    objeto_id = models.CharField(max_length=40, blank=True)
    descricao = models.CharField(max_length=255, blank=True)
    dados = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-momento", "-id"]
        verbose_name = "registo de auditoria"
        verbose_name_plural = "registos de auditoria"
        indexes = [models.Index(fields=["objeto_tipo", "objeto_id"])]

    def __str__(self):
        return f"{self.momento:%Y-%m-%d %H:%M} {self.acao}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise RuntimeError("Os registos de auditoria são imutáveis.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Os registos de auditoria não podem ser eliminados.")


class LigacaoExterna(models.Model):
    """Ligação para uma pasta ou ficheiro externo (OneDrive, Google Drive, …) associada a um
    registo de qualquer módulo. O CRM guarda apenas o endereço, não os ficheiros."""

    tipo_conteudo = models.ForeignKey("contenttypes.ContentType", on_delete=models.PROTECT, related_name="+")
    objeto_id = models.PositiveBigIntegerField()
    registo = GenericForeignKey("tipo_conteudo", "objeto_id")
    tipo = models.ForeignKey(
        "configuracao.ValorLista",
        on_delete=models.PROTECT,
        related_name="+",
        limit_choices_to={"lista__chave": "tipos_ligacao"},
    )
    titulo = models.CharField("título", max_length=150)
    url = models.URLField("endereço", max_length=1000)
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["tipo__ordem", "titulo", "id"]
        verbose_name = "ligação externa"
        verbose_name_plural = "ligações externas"
        indexes = [models.Index(fields=["tipo_conteudo", "objeto_id"])]

    def __str__(self):
        return self.titulo


class Interacao(models.Model):
    """Registo de um contacto (chamada, reunião, email…) associado a um registo de qualquer módulo.
    É um diário: não se edita; um registo errado pode ser anulado (fica marcado e auditado)."""

    tipo_conteudo = models.ForeignKey("contenttypes.ContentType", on_delete=models.PROTECT, related_name="+")
    objeto_id = models.PositiveBigIntegerField()
    registo = GenericForeignKey("tipo_conteudo", "objeto_id")
    tipo = models.ForeignKey(
        "configuracao.ValorLista",
        on_delete=models.PROTECT,
        related_name="+",
        limit_choices_to={"lista__chave": "tipos_interacao"},
    )
    momento = models.DateTimeField(help_text="Quando aconteceu o contacto.")
    resumo = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    anulada_em = models.DateTimeField(null=True, blank=True)
    anulada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        ordering = ["-momento", "-id"]
        verbose_name = "interação"
        verbose_name_plural = "interações"
        indexes = [models.Index(fields=["tipo_conteudo", "objeto_id"])]

    def __str__(self):
        return f"{self.momento:%Y-%m-%d} {self.tipo}"
