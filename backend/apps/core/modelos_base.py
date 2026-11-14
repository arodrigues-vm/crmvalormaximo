"""Campos e comportamento comuns aos registos de negócio."""

from django.conf import settings
from django.db import models
from django.utils import timezone


class RegistoQuerySet(models.QuerySet):
    def ativos(self):
        return self.filter(eliminado_em__isnull=True)

    def na_lixeira(self):
        return self.filter(eliminado_em__isnull=False)


class RegistoBase(models.Model):
    """Rastreabilidade, controlo de concorrência e lixeira recuperável.

    - `versao` é incrementada a cada gravação; a API recusa gravações feitas sobre
      uma versão desatualizada (proteção contra alterações concorrentes).
    - Eliminar envia para a lixeira (`eliminado_em`); nada é apagado fisicamente.
    """

    PREFIXO_REFERENCIA = "REG"

    referencia = models.CharField(max_length=20, unique=True, editable=False, null=True)  # noqa: DJ001 — NULL até ser atribuída
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+", editable=False
    )
    atualizado_em = models.DateTimeField(auto_now=True)
    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="+", editable=False
    )
    versao = models.PositiveIntegerField(default=1, editable=False)
    eliminado_em = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)
    eliminado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
        editable=False,
    )

    objects = RegistoQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        novo = self.pk is None
        if not novo:
            self.versao = (self.versao or 0) + 1
        super().save(*args, **kwargs)
        if novo and not self.referencia:
            self.referencia = f"{self.PREFIXO_REFERENCIA}-{self.pk:06d}"
            type(self).objects.filter(pk=self.pk).update(referencia=self.referencia)

    def enviar_para_lixeira(self, utilizador):
        self.eliminado_em = timezone.now()
        self.eliminado_por = utilizador
        self.atualizado_por = utilizador
        self.save()

    def restaurar(self, utilizador):
        self.eliminado_em = None
        self.eliminado_por = None
        self.atualizado_por = utilizador
        self.save()
