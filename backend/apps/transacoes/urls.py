from rest_framework.routers import DefaultRouter

from .views import TransacaoViewSet

router = DefaultRouter()
router.register("transacoes", TransacaoViewSet, basename="transacao")
urlpatterns = router.urls
