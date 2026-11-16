from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Procura


@admin.register(Procura)
class ProcuraAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "entidade", "pretende", "estado", "orcamento_max", "responsavel"]
    raw_id_fields = ["entidade"]
    readonly_fields = ["referencia", "versao"]

    def has_delete_permission(self, request, obj=None):
        return False
