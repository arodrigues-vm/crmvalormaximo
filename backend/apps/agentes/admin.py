from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Agencia, Agente


@admin.register(Agencia)
class AgenciaAdmin(SimpleHistoryAdmin):
    list_display = ["nome", "tipo", "status", "licenca_ami", "telefone_e164"]
    search_fields = ["nome", "nif", "licenca_ami"]


@admin.register(Agente)
class AgenteAdmin(SimpleHistoryAdmin):
    list_display = ["nome", "tipo", "agencia", "status", "utilizador"]
    search_fields = ["nome", "nif", "email"]
