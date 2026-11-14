from rest_framework.routers import DefaultRouter

from .views import AngariacaoViewSet

router = DefaultRouter()
router.register("angariacoes", AngariacaoViewSet, basename="angariacao")
urlpatterns = router.urls
