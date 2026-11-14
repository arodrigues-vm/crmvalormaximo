from django.contrib import admin

from .models import Concelho, Distrito, Freguesia


@admin.register(Distrito)
class DistritoAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nome", "regiao_autonoma"]


@admin.register(Concelho)
class ConcelhoAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nome", "distrito"]
    list_filter = ["distrito"]
    search_fields = ["nome", "codigo"]


@admin.register(Freguesia)
class FreguesiaAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nome", "concelho", "ativa"]
    list_filter = ["ativa", "concelho__distrito"]
    search_fields = ["nome", "codigo"]
