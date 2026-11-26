from rest_framework.routers import DefaultRouter

from .views import CompromissoViewSet

router = DefaultRouter()
router.register("agenda/compromissos", CompromissoViewSet, basename="compromisso")
urlpatterns = router.urls
