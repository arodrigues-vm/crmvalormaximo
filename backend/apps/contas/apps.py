from django.apps import AppConfig
from django.db.models.signals import post_migrate


class ContasConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.contas"
    verbose_name = "Contas e permissões"

    def ready(self):
        from . import signals  # noqa: F401

        post_migrate.connect(_semear, sender=self)


def _semear(sender, **kwargs):
    from .modulos import semear_permissoes

    semear_permissoes()
