from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Operacao
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis

from .correspondencias import correspondencias_da_procura
from .models import Importancia, Pretende, Procura
from .serializers import CAMPOS_QUALIFICACAO, LISTAS_QUALIFICACAO, ProcuraListaSerializer, ProcuraSerializer


class ProcuraViewSet(RegistoViewSet):
    modulo = "procuras"
    modelo = Procura
    nome_registo = "procura"
    operacoes_extra = {**RegistoViewSet.operacoes_extra, "correspondencias": Operacao.CONSULTAR}
    campos_auditados = [
        "entidade_id", "pretende", "estado_id", "urgencia_id",
        *[f"{c}_id" if c in LISTAS_QUALIFICACAO else c for c in CAMPOS_QUALIFICACAO],
        "orcamento_max", "tolerancia_pct", "imp_tipos", "imp_tipologias",
        "imp_localizacao", "quartos_min", "imp_quartos", "wcs_min", "imp_wcs", "area_min", "imp_area",
        "imp_zonas_exteriores",
        "exige_elevador", "imp_elevador", "estacionamento_min", "imp_estacionamento", "imp_condicoes",
        "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return ProcuraListaSerializer if self.action == "list" else ProcuraSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        qs = Procura.objects.select_related("entidade", "estado", "urgencia", "responsavel", *LISTAS_QUALIFICACAO)
        return qs.prefetch_related(
            "tipos", "tipologias", "concelhos", "freguesias__concelho", "zonas_comerciais", "zonas_exteriores",
            "condicoes_fisicas",
        )  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(entidade__nome_completo__unaccent__icontains=termo)
                | Q(observacoes__unaccent__icontains=termo)
            )
        for parametro, campo in (("estado", "estado_id"), ("pretende", "pretende"), ("urgencia", "urgencia_id"),
                                 ("entidade", "entidade_id")):  # fmt: skip
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        if p.get("categoria"):
            qs = qs.filter(estado__categoria=p["categoria"])
        return qs.order_by("-criado_em", "-id")

    @extend_schema(
        parameters=[
            OpenApiParameter(n, str) for n in ("pesquisa", "estado", "categoria", "pretende", "urgencia", "entidade")
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "estados": opcoes_lista("estados_procura"),
                "pretende": [{"valor": v, "nome": n} for v, n in Pretende.choices],
                "urgencias": opcoes_lista("urgencias"),
                "tipos_imovel": opcoes_lista("tipos_imovel"),
                "tipologias": opcoes_lista("tipologias"),
                "zonas_comerciais": opcoes_lista("zonas_comerciais"),
                "zonas_exteriores": opcoes_lista("zonas_exteriores"),
                "condicoes_fisicas": opcoes_lista("condicoes_fisicas"),
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                "importancias": [{"valor": v, "nome": n} for v, n in Importancia.choices],
                **{chave: opcoes_lista(chave) for chave in set(LISTAS_QUALIFICACAO.values())},
                **self.permissoes_gerais(request),
            }
        )

    @action(detail=True, methods=["get"])
    def correspondencias(self, request, pk=None):
        p = self.get_object()
        return Response({"resultados": correspondencias_da_procura(p, request.user), "teto": p.teto})
