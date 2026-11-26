from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import PlanoMarketing


@admin.register(PlanoMarketing)
class PlanoMarketingAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "imovel", "angariacao", "ciclo", "data_base", "responsavel"]
    search_fields = ["referencia"]
