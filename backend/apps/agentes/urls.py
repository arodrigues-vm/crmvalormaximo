from rest_framework.routers import DefaultRouter

from .views import AgenciaViewSet, AgenteViewSet

router = DefaultRouter()
router.register("agencias", AgenciaViewSet, basename="agencia")
router.register("agentes", AgenteViewSet, basename="agente")
urlpatterns = router.urls
