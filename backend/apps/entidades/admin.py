from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Entidade, OrigemContacto, PapelEntidade, TelefoneEntidade


class TelefoneInline(admin.TabularInline):
    model = TelefoneEntidade
    extra = 0
    readonly_fields = ["numero_e164"]


@admin.register(Entidade)
class EntidadeAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "nome_completo", "nif", "email", "responsavel", "ativa", "eliminado_em"]
    list_filter = ["tipo_pessoa", "ativa", "papeis"]
    search_fields = ["nome_completo", "nif", "email", "referencia"]
    readonly_fields = ["referencia", "nome_completo", "versao", "criado_em", "atualizado_em", "eliminado_em"]
    inlines = [TelefoneInline]

    def has_delete_permission(self, request, obj=None):
        return False  # usar a lixeira da aplicação


@admin.register(PapelEntidade)
class PapelAdmin(admin.ModelAdmin):
    list_display = ["nome", "ordem", "ativo"]
    list_editable = ["ordem", "ativo"]


@admin.register(OrigemContacto)
class OrigemAdmin(admin.ModelAdmin):
    list_display = ["nome", "ativa"]
    list_editable = ["ativa"]
