from rest_framework.routers import DefaultRouter

from .views import PlanoMarketingViewSet

router = DefaultRouter()
router.register("planos-marketing", PlanoMarketingViewSet, basename="plano-marketing")
urlpatterns = router.urls
