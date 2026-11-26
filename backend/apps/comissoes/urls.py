from rest_framework.routers import DefaultRouter

from .views import ComissaoViewSet

router = DefaultRouter()
router.register("comissoes", ComissaoViewSet, basename="comissao")
urlpatterns = router.urls
