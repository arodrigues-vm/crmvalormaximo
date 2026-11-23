from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Proposta, Ronda


class RondaInline(admin.TabularInline):
    model = Ronda
    extra = 0
    readonly_fields = [f.name for f in Ronda._meta.fields]
    can_delete = False


@admin.register(Proposta)
class PropostaAdmin(SimpleHistoryAdmin):
    list_display = ["referencia", "entidade", "imovel", "estado", "responsavel", "criado_em"]
    search_fields = ["referencia", "entidade__nome_completo", "imovel__referencia"]
    inlines = [RondaInline]
