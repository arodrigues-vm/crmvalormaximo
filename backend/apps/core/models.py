from django.conf import settings
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
