from django.urls import include, path

from . import views

urlpatterns = [
    path("saude/", views.saude, name="saude"),
    path("auth/", include("apps.contas.urls")),
    path("telefone/paises/", views.paises, name="telefone-paises"),
    path("", include("apps.entidades.urls")),
    path("localizacao/", include("apps.localizacao.urls")),
]
