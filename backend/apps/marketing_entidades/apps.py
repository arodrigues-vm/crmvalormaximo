from django.apps import AppConfig


class MarketingEntidadesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.marketing_entidades"
    verbose_name = "Marketing de Entidades"

    def ready(self):
        from . import sinais  # noqa: F401 — gatilhos (D-55)
