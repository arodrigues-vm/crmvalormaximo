from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Oportunidade


@admin.register(Oportunidade)
class OportunidadeAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "entidade", "estado", "qualificacao", "responsavel", "criado_em"]
    raw_id_fields = ["entidade", "imovel"]
    readonly_fields = ["referencia", "versao", "angariacao_gerada"]

    def has_delete_permission(self, request, obj=None):
        return False
