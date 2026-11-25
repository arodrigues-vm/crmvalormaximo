from django.urls import path
from rest_framework.routers import DefaultRouter

from .equipa import EquipaViewSet, MembroViewSet, responsaveis

router = DefaultRouter()
router.register("membros", MembroViewSet, basename="membro")
router.register("equipas", EquipaViewSet, basename="equipa")
urlpatterns = [path("responsaveis/", responsaveis, name="responsaveis"), *router.urls]
