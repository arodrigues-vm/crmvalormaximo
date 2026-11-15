from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Concelho, Distrito, Freguesia


@api_view(["GET"])
def distritos(request):
    return Response(list(Distrito.objects.values("id", "codigo", "nome", "regiao_autonoma")))


@extend_schema(parameters=[OpenApiParameter("distrito", int), OpenApiParameter("pesquisa", str)])
@api_view(["GET"])
def concelhos(request):
    """Por distrito, ou pesquisa por nome (insensível a acentos) em todo o país."""
    p = request.query_params
    if p.get("distrito"):
        qs = Concelho.objects.filter(distrito_id=p["distrito"])
    elif (p.get("pesquisa") or "").strip():
        qs = Concelho.objects.filter(nome__unaccent__icontains=p["pesquisa"].strip())[:30]
    else:
        return Response([])
    return Response(
        [
            {"id": c.id, "codigo": c.codigo, "nome": c.nome, "distrito": c.distrito.nome}
            for c in qs.select_related("distrito")
        ]
    )


@extend_schema(parameters=[OpenApiParameter("concelho", int), OpenApiParameter("pesquisa", str)])
@api_view(["GET"])
def freguesias(request):
    """Por concelho, ou pesquisa por nome (insensível a acentos) em todo o país."""
    p = request.query_params
    qs = Freguesia.objects.select_related("concelho__distrito").filter(ativa=True)
    if p.get("concelho"):
        qs = qs.filter(concelho_id=p["concelho"])
    elif (p.get("pesquisa") or "").strip():
        qs = qs.filter(nome__unaccent__icontains=p["pesquisa"].strip())[:30]
    else:
        return Response([])
    return Response(
        [
            {
                "id": f.id,
                "codigo": f.codigo,
                "nome": f.nome,
                "concelho": f.concelho.nome,
                "distrito": f.concelho.distrito.nome,
            }  # fmt: skip
            for f in qs
        ]
    )
