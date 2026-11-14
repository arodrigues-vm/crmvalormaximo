from django.contrib import admin

from .models import Lista, ValorLista


class ValorInline(admin.TabularInline):
    model = ValorLista
    extra = 0


@admin.register(Lista)
class ListaAdmin(admin.ModelAdmin):
    list_display = ["nome", "chave", "modulo"]
    readonly_fields = ["chave"]
    inlines = [ValorInline]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
