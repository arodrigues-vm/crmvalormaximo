from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("entrar/", views.EntrarView.as_view(), name="auth-entrar"),
    path("sair/", views.SairView.as_view(), name="auth-sair"),
    path("eu/", views.EuView.as_view(), name="auth-eu"),
    path("recuperar/", views.RecuperarView.as_view(), name="auth-recuperar"),
    path("recuperar/confirmar/", views.ConfirmarRecuperacaoView.as_view(), name="auth-recuperar-confirmar"),
]
