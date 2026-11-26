from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import DocumentoConsultor, Movimento, Prestacao


@admin.register(DocumentoConsultor)
class DocumentoAdmin(SimpleHistoryAdmin):
    list_display = ("referencia", "consultor", "tipo", "serie", "numero", "data_emissao", "total")


@admin.register(Movimento)
class MovimentoAdmin(admin.ModelAdmin):
    """Só leitura: o livro de pagamentos é imutável."""

    list_display = ("documento", "tipo", "estado", "data_efetiva", "valor", "criado_por")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False


admin.site.register(Prestacao)
