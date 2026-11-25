from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis
from apps.oportunidades.views import imoveis_visiveis

from .models import CRITERIOS_AVALIACAO, Interesse, Visita
from .serializers import InteresseListaSerializer, InteresseSerializer, VisitaListaSerializer, VisitaSerializer

FILTROS = ("pesquisa", "estado", "categoria", "entidade", "imovel", "desde", "ate")


class _Contexto:
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        ctx["imoveis_visiveis"] = imoveis_visiveis(self.request.user)
        return ctx

    def _comuns(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(entidade__nome_completo__unaccent__icontains=termo)
                | Q(imovel__referencia__icontains=termo)
                | Q(imovel__localidade__unaccent__icontains=termo)
                | self.pesquisa_extra(termo)
            )
        for parametro, campo in (("estado", "estado_id"), ("entidade", "entidade_id"), ("imovel", "imovel_id")):
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        if p.get("categoria"):
            qs = qs.filter(estado__categoria=p["categoria"])
        return qs


class VisitaViewSet(_Contexto, RegistoViewSet):
    def pesquisa_extra(self, termo):
        return (
            Q(imovel_descricao__unaccent__icontains=termo)
            | Q(imovel_localizacao__unaccent__icontains=termo)
            | Q(agente_comprador__nome__unaccent__icontains=termo)
            | Q(agente_imovel__nome__unaccent__icontains=termo)
        )

    modulo = "visitas"
    modelo = Visita
    nome_registo = "visita"
    campos_auditados = [
        "imovel_id", "imovel_descricao", "imovel_localizacao", "agente_comprador_id", "agente_imovel_id",
        "entidade_id", "procura_id", "data", "hora_entrada", "hora_saida", "estado_id",
        *[f"{c}_id" for c in CRITERIOS_AVALIACAO], "mais_gostou", "menos_gostou", "compraria_id",
        "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return VisitaListaSerializer if self.action == "list" else VisitaSerializer

    def base_queryset(self):
        return Visita.objects.select_related(
            "entidade", "imovel__tipo", "imovel__tipologia", "estado", "responsavel", "procura", "compraria",
            "agente_comprador__agencia__tipo", "agente_imovel__agencia",
            *CRITERIOS_AVALIACAO,
        ).prefetch_related("acompanhantes")  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        qs = self._comuns(qs)
        if p.get("desde"):
            qs = qs.filter(data__gte=p["desde"])
        if p.get("ate"):
            qs = qs.filter(data__lte=p["ate"])
        ordem = ["data", "hora_entrada", "id"] if p.get("ordem") == "proximas" else ["-data", "-hora_entrada", "-id"]
        return qs.order_by(*ordem)

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in (*FILTROS, "ordem")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "estados": opcoes_lista("estados_visita"),
                "avaliacoes": opcoes_lista("avaliacoes_visita"),
                "sim_nao": opcoes_lista("sim_nao"),
                "criterios": [{"campo": c, "nome": n} for c, n in CRITERIOS_AVALIACAO.items()],
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                **self.permissoes_gerais(request),
            }
        )


class InteresseViewSet(_Contexto, RegistoViewSet):
    def pesquisa_extra(self, termo):
        return Q(pk__in=[])

    modulo = "visitas"
    ecra = "interesses"
    modelo = Interesse
    nome_registo = "interesse"
    campos_auditados = [
        "entidade_id", "imovel_id", "origem_id", "grau_id", "estado_id", "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return InteresseListaSerializer if self.action == "list" else InteresseSerializer

    def base_queryset(self):
        return Interesse.objects.select_related(
            "entidade", "imovel__tipo", "imovel__tipologia", "origem", "grau", "estado", "responsavel"
        )

    def filtros(self, qs):
        return self._comuns(qs).order_by("-atualizado_em", "-id")

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in FILTROS[:5]])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "estados": opcoes_lista("estados_interesse"),
                "graus": opcoes_lista("graus_interesse"),
                "origens": opcoes_lista("origens_interesse"),
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                **self.permissoes_gerais(request),
            }
        )
