from rest_framework.routers import DefaultRouter

from .views import EntidadeViewSet

router = DefaultRouter()
router.register("entidades", EntidadeViewSet, basename="entidade")
urlpatterns = router.urls
