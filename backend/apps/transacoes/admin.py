from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import ParticipanteTransacao, Transacao


class ParticipanteInline(admin.TabularInline):
    model = ParticipanteTransacao
    extra = 0


@admin.register(Transacao)
class TransacaoAdmin(SimpleHistoryAdmin):
    list_display = ("referencia", "entidade", "imovel", "estado", "valor", "responsavel")
    search_fields = ("referencia",)
    inlines = [ParticipanteInline]
