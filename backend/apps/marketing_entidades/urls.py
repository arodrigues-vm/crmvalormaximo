from rest_framework.routers import DefaultRouter

from .views import InscricaoViewSet, PlanoEntidadesViewSet

router = DefaultRouter()
router.register("marketing-entidades/planos", PlanoEntidadesViewSet, basename="plano-entidades")
router.register("marketing-entidades/inscricoes", InscricaoViewSet, basename="inscricao-marketing")
urlpatterns = router.urls
