from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Imovel, Proprietario


class ProprietarioInline(admin.TabularInline):
    model = Proprietario
    extra = 0
    raw_id_fields = ["entidade"]


@admin.register(Imovel)
class ImovelAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "tipo", "tipologia", "operacao", "status", "preco", "responsavel"]
    list_filter = ["operacao", "status"]
    search_fields = ["referencia", "localidade", "rua"]
    readonly_fields = ["referencia", "versao", "criado_em", "atualizado_em", "eliminado_em"]
    inlines = [ProprietarioInline]

    def has_delete_permission(self, request, obj=None):
        return False
