from rest_framework.routers import DefaultRouter

from .views import ModeloTarefaViewSet, TarefaViewSet

router = DefaultRouter()
router.register("tarefas", TarefaViewSet, basename="tarefa")
router.register("modelos-tarefa", ModeloTarefaViewSet, basename="modelo-tarefa")
urlpatterns = router.urls
