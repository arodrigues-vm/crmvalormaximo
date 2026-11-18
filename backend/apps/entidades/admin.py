from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Entidade, RelacaoEntidade, TelefoneEntidade, TipoRelacao


class TelefoneInline(admin.TabularInline):
    model = TelefoneEntidade
    extra = 0
    readonly_fields = ["numero_e164"]


@admin.register(Entidade)
class EntidadeAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "nome_completo", "nif", "email", "responsavel", "status", "eliminado_em"]
    list_filter = ["tipo_pessoa", "status", "papeis"]
    search_fields = ["nome_completo", "nif", "email", "referencia"]
    readonly_fields = ["referencia", "nome_completo", "versao", "criado_em", "atualizado_em", "eliminado_em"]
    inlines = [TelefoneInline]

    def has_delete_permission(self, request, obj=None):
        return False  # usar a lixeira da aplicação


@admin.register(TipoRelacao)
class TipoRelacaoAdmin(admin.ModelAdmin):
    list_display = ["nome", "nome_inverso", "simetrica", "ordem", "ativo"]
    list_editable = ["ordem", "ativo"]


@admin.register(RelacaoEntidade)
class RelacaoEntidadeAdmin(SimpleHistoryAdmin):
    list_display = ["origem", "tipo", "destino", "criado_em"]
    raw_id_fields = ["origem", "destino"]
