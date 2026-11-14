from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import ConfiguracaoMFA, Equipa, PermissaoPerfil, PermissaoUtilizador, Utilizador


@admin.register(Utilizador)
class UtilizadorAdmin(UserAdmin):
    ordering = ["nome"]
    list_display = ["nome", "email", "perfil", "equipa", "is_active"]
    list_filter = ["perfil", "equipa", "is_active"]
    search_fields = ["nome", "email"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Identificação", {"fields": ["nome", "funcao_comercial"]}),
        ("Acesso", {"fields": ["perfil", "equipa", "is_active", "is_staff", "is_superuser"]}),
        ("Datas", {"fields": ["last_login", "date_joined"]}),
    ]
    add_fieldsets = [(None, {"fields": ["email", "nome", "perfil", "equipa", "password1", "password2"]})]
    filter_horizontal = []


@admin.register(Equipa)
class EquipaAdmin(admin.ModelAdmin):
    list_display = ["nome", "ativa"]


@admin.register(PermissaoPerfil)
class PermissaoPerfilAdmin(admin.ModelAdmin):
    list_display = ["perfil", "modulo", "operacao", "ambito"]
    list_filter = ["perfil", "modulo", "operacao"]
    list_editable = ["ambito"]


@admin.register(PermissaoUtilizador)
class PermissaoUtilizadorAdmin(admin.ModelAdmin):
    list_display = ["utilizador", "modulo", "operacao", "ambito"]


@admin.register(ConfiguracaoMFA)
class ConfiguracaoMFAAdmin(admin.ModelAdmin):
    """Permite ao Administrador repor o MFA de um utilizador (eliminando a configuração)."""

    list_display = ["utilizador", "ativa", "ativada_em"]
    readonly_fields = ["utilizador", "ativa", "ativada_em"]
    exclude = ["segredo_cifrado", "ultimo_passo"]

    def has_add_permission(self, request):
        return False
