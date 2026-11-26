from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import ModeloTarefa, Tarefa


@admin.register(Tarefa)
class TarefaAdmin(SimpleHistoryAdmin):
    list_display = ("referencia", "titulo", "estado", "prazo", "responsavel", "transacao")


@admin.register(ModeloTarefa)
class ModeloAdmin(SimpleHistoryAdmin):
    list_display = ("nome", "dias_apos", "ativo", "ordem")
