from django.apps import AppConfig


class TarefasConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tarefas"
    verbose_name = "Tarefas"

    def ready(self):
        from django.db.models.signals import post_migrate

        from .modelos_iniciais import semear_modelos

        post_migrate.connect(semear_modelos, sender=self)
