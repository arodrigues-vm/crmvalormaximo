from django.urls import include, path

from . import views

urlpatterns = [
    path("saude/", views.saude, name="saude"),
    path("auth/", include("apps.contas.urls")),
]
