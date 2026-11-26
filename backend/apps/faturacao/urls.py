from rest_framework.routers import DefaultRouter

from .views import DocumentoViewSet

router = DefaultRouter()
router.register("documentos-consultor", DocumentoViewSet, basename="documento-consultor")
urlpatterns = router.urls
