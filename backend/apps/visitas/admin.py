from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Interesse, Visita


@admin.register(Visita)
class VisitaAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "data", "entidade", "imovel", "estado", "responsavel"]
    search_fields = ["referencia", "entidade__nome_completo", "imovel__referencia"]


@admin.register(Interesse)
class InteresseAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "entidade", "imovel", "grau", "estado", "ultima_visita"]
    search_fields = ["referencia", "entidade__nome_completo", "imovel__referencia"]
