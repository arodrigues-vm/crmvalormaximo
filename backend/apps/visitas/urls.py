from rest_framework.routers import DefaultRouter

from .views import InteresseViewSet, VisitaViewSet

router = DefaultRouter()
router.register("visitas", VisitaViewSet, basename="visita")
router.register("interesses", InteresseViewSet, basename="interesse")
urlpatterns = router.urls
