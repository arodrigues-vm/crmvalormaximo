from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Inscricao, PlanoEntidades


@admin.register(PlanoEntidades)
class PlanoEntidadesAdmin(SimpleHistoryAdmin):
    list_display = ["nome", "fundamento", "ativo", "ordem"]


@admin.register(Inscricao)
class InscricaoAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "entidade", "plano", "estado", "inicio"]
