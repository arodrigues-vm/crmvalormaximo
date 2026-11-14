from django.apps import AppConfig
from django.db.models.signals import post_migrate


class ConfiguracaoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.configuracao"
    verbose_name = "Configuração"

    def ready(self):
        post_migrate.connect(_semear, sender=self)


def _semear(sender, **kwargs):
    from .listas_sistema import semear_listas

    semear_listas()
