from django.urls import path

from . import views

urlpatterns = [
    path("", views.listas, name="listas"),
    path("valores/<int:pk>/", views.alterar_valor, name="listas-valor"),
    path("<slug:chave>/valores/", views.adicionar_valor, name="listas-adicionar"),
    path("<slug:chave>/ordenar/", views.ordenar, name="listas-ordenar"),
]
