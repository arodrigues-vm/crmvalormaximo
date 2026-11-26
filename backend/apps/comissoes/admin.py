from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Beneficiario, Comissao, ExcecaoComissao


class BeneficiarioInline(admin.TabularInline):
    model = Beneficiario
    extra = 0


@admin.register(Comissao)
class ComissaoAdmin(SimpleHistoryAdmin):
    list_display = ("referencia", "transacao", "valor_final", "origem", "responsavel")
    inlines = [BeneficiarioInline]


@admin.register(ExcecaoComissao)
class ExcecaoAdmin(admin.ModelAdmin):
    list_display = ("comissao", "valor_original", "valor_proposto", "estado", "requerente", "decidido_por")
