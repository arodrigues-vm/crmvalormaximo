from django.urls import include, path

from apps.configuracao import views as configuracao_views

from . import views

urlpatterns = [
    path("saude/", views.saude, name="saude"),
    path("auth/", include("apps.contas.urls")),
    path("telefone/paises/", views.paises, name="telefone-paises"),
    path("", include("apps.entidades.urls")),
    path("", include("apps.imoveis.urls")),
    path("", include("apps.angariacoes.urls")),
    path("", include("apps.oportunidades.urls")),
    path("", include("apps.procuras.urls")),
    path("", include("apps.agentes.urls")),
    path("", include("apps.visitas.urls")),
    path("localizacao/", include("apps.localizacao.urls")),
    path("listas/", include("apps.configuracao.urls")),
    path("parametros/", configuracao_views.parametros, name="parametros"),
    path("parametros/<slug:chave>/", configuracao_views.alterar_parametro, name="parametro"),
]
