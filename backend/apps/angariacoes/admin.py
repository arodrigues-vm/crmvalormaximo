from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Angariacao, CorrecaoMaterial, Interveniente, Renovacao


class IntervenienteInline(admin.TabularInline):
    model = Interveniente
    extra = 0
    raw_id_fields = ["entidade"]


class RenovacaoInline(admin.TabularInline):
    model = Renovacao
    extra = 0
    readonly_fields = ["ciclo", "forma", "data_inicio", "prazo_meses", "data_fim", "criado_por"]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Angariacao)
class AngariacaoAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "imovel", "regime", "data_inicio", "data_fim_vigente", "situacao", "responsavel"]
    list_filter = ["situacao", "regime"]
    search_fields = ["referencia", "numero_contrato"]
    readonly_fields = ["referencia", "data_fim", "data_fim_vigente", "versao", "criado_em", "atualizado_em"]
    raw_id_fields = ["imovel"]
    inlines = [IntervenienteInline, RenovacaoInline]

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CorrecaoMaterial)
class CorrecaoAdmin(admin.ModelAdmin):
    list_display = ["angariacao", "campo", "valor_anterior", "valor_novo", "criado_por", "criado_em"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
