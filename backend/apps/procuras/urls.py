from rest_framework.routers import DefaultRouter

from .views import ProcuraViewSet

router = DefaultRouter()
router.register("procuras", ProcuraViewSet, basename="procura")
urlpatterns = router.urls
