from django.contrib import admin

from .models import RegistoAuditoria


@admin.register(RegistoAuditoria)
class RegistoAuditoriaAdmin(admin.ModelAdmin):
    list_display = ["momento", "acao", "modulo", "utilizador", "objeto_tipo", "objeto_id", "ip"]
    list_filter = ["acao", "modulo"]
    search_fields = ["descricao", "objeto_id"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
