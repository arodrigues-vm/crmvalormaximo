from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Compromisso


@admin.register(Compromisso)
class CompromissoAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "titulo", "inicio", "estado", "responsavel"]
    search_fields = ["referencia", "titulo"]
