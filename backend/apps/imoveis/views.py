from decimal import Decimal, InvalidOperation

from django.db.models import Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar
from apps.core.vistas import RegistoViewSet
from apps.entidades.models import Entidade

from .models import Imovel, Proprietario
from .serializers import ImovelListaSerializer, ImovelSerializer

ORDENACOES = {
    "recentes": "-criado_em",
    "referencia": "id",
    "preco": "preco",
    "-preco": "-preco",
}
LISTAS = {
    "tipos": "tipos_imovel",
    "tipologias": "tipologias",
    "estados_comercializacao": "estados_comercializacao",
    "condicoes_fisicas": "condicoes_fisicas",
    "zonas_comerciais": "zonas_comerciais",
    "certificados_energeticos": "certificados_energeticos",
    "zonas_exteriores": "zonas_exteriores",
}


def entidades_visiveis(utilizador) -> set[int]:
    qs = filtrar(
        utilizador, "entidades", Operacao.CONSULTAR, Entidade.objects.ativos(), campo_partilhas="partilhada_com"
    )
    return set(qs.values_list("pk", flat=True))


class ImovelViewSet(RegistoViewSet):
    modulo = "imoveis"
    modelo = Imovel
    nome_registo = "imovel"
    campos_auditados = [
        "tipo_id", "tipologia_id", "operacao", "estado_comercializacao_id", "status", "condicao_fisica_id", "preco",
        "rua", "numero_policia", "complemento", "codigo_postal", "localidade", "freguesia_id", "zona_comercial_id",
        "localizacao_descritiva", "area_bruta_privativa", "area_bruta_dependente", "area_util", "area_terreno",
        "quartos", "casas_banho", "ano_construcao", "piso", "elevador", "lugares_estacionamento",
        "certificado_energetico_id", "descricao", "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return ImovelListaSerializer if self.action == "list" else ImovelSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Imovel.objects.select_related(
            "tipo", "tipologia", "estado_comercializacao", "condicao_fisica", "zona_comercial",
            "certificado_energetico", "responsavel", "freguesia__concelho__distrito",
        ).prefetch_related(
            "zonas_exteriores",
            Prefetch("proprietarios", queryset=Proprietario.objects.select_related("entidade")),
        )  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(rua__unaccent__icontains=termo)
                | Q(localidade__unaccent__icontains=termo)
                | Q(localizacao_descritiva__unaccent__icontains=termo)
                | Q(freguesia__nome__unaccent__icontains=termo)
                | Q(freguesia__concelho__nome__unaccent__icontains=termo)
                | Q(proprietarios__entidade__nome_completo__unaccent__icontains=termo)
            ).distinct()
        for parametro, campo in (
            ("tipo", "tipo_id"),
            ("tipologia", "tipologia_id"),
            ("estado_comercializacao", "estado_comercializacao_id"),
            ("operacao", "operacao"),
            ("responsavel", "responsavel_id"),
        ):
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        # Por omissão não se mostram os arquivados.
        status_ = p.get("status")
        qs = qs.filter(status=status_) if status_ else qs.exclude(status=Imovel.Status.ARQUIVADO)
        for parametro, lookup in (("preco_min", "preco__gte"), ("preco_max", "preco__lte")):
            try:
                if p.get(parametro):
                    qs = qs.filter(**{lookup: Decimal(p[parametro])})
            except InvalidOperation:
                pass
        return qs.order_by(ORDENACOES.get(p.get("ordenar", "recentes"), "-criado_em"), "-id")

    @extend_schema(
        parameters=[
            OpenApiParameter(n, str)
            for n in (
                "pesquisa",
                "tipo",
                "tipologia",
                "estado_comercializacao",
                "operacao",
                "status",
                "preco_min",
                "preco_max",
                "responsavel",
                "ordenar",
            )
        ]  # fmt: skip
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                **{nome: opcoes_lista(chave) for nome, chave in LISTAS.items()},
                "operacoes": [{"valor": v, "nome": n} for v, n in Imovel.Operacao.choices],
                "status": [{"valor": v, "nome": n} for v, n in Imovel.Status.choices],
                **self.permissoes_gerais(request),
            }
        )
