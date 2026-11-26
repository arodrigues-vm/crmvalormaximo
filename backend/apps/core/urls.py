from django.urls import include, path

from apps.configuracao import views as configuracao_views

from . import views

urlpatterns = [
    path("saude/", views.saude, name="saude"),
    path("auth/", include("apps.contas.urls")),
    path("equipa/", include("apps.contas.urls_equipa")),
    path("telefone/paises/", views.paises, name="telefone-paises"),
    path("", include("apps.entidades.urls")),
    path("", include("apps.imoveis.urls")),
    path("", include("apps.angariacoes.urls")),
    path("", include("apps.oportunidades.urls")),
    path("", include("apps.procuras.urls")),
    path("", include("apps.agentes.urls")),
    path("", include("apps.visitas.urls")),
    path("", include("apps.propostas.urls")),
    path("", include("apps.transacoes.urls")),
    path("", include("apps.comissoes.urls")),
    path("", include("apps.faturacao.urls")),
    path("", include("apps.tarefas.urls")),
    path("", include("apps.agenda.urls")),
    path("", include("apps.marketing.urls")),
    path("localizacao/", include("apps.localizacao.urls")),
    path("listas/", include("apps.configuracao.urls")),
    path("parametros/", configuracao_views.parametros, name="parametros"),
    path("campos-personalizados/", configuracao_views.campos_personalizados, name="campos-personalizados"),
    path(
        "campos-personalizados/procurar/", configuracao_views.procurar_registos, name="campos-personalizados-procurar"
    ),
    path("campos-personalizados/<int:pk>/", configuracao_views.campo_personalizado, name="campo-personalizado"),
    path("disposicoes/<slug:modulo>/", configuracao_views.disposicao, name="disposicao"),
    path("parametros/<slug:chave>/", configuracao_views.alterar_parametro, name="parametro"),
]
