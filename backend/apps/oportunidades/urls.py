from rest_framework.routers import DefaultRouter

from .views import OportunidadeViewSet

router = DefaultRouter()
router.register("oportunidades", OportunidadeViewSet, basename="oportunidade")
urlpatterns = router.urls
