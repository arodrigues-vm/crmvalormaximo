from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.core.vistas import RegistoViewSet

from .models import Agencia, Agente
from .serializers import AgenciaSerializer, AgenteSerializer

CONTACTOS = ["nome", "tipo_id", "status_id", "nif", "telefone", "email", "responsavel_id", "observacoes"]


class _Lista:
    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            digitos = "".join(c for c in termo if c.isdigit())
            cond = Q(nome__unaccent__icontains=termo) | Q(referencia__iexact=termo) | Q(email__icontains=termo)
            if len(digitos) >= 3:
                cond |= Q(nif__startswith=digitos) | Q(telefone_e164__contains=digitos)
            qs = qs.filter(cond | self.pesquisa_extra(termo))
        for parametro, campo in (("tipo", "tipo_id"), ("status", "status_id")):
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        if p.get("categoria_status"):
            qs = qs.filter(status__categoria=p["categoria_status"])
        return self.filtros_extra(qs, p).order_by("nome", "id")

    def filtros_extra(self, qs, p):
        return qs

    def pesquisa_extra(self, termo) -> Q:
        return Q(pk__in=[])


class AgenciaViewSet(_Lista, RegistoViewSet):
    modulo = "agencias"
    modelo = Agencia
    nome_registo = "agencia"
    serializer_class = AgenciaSerializer
    campos_auditados = [
        *CONTACTOS, "licenca_ami", "nome_responsavel", "site", "rua", "numero_policia", "complemento",
        "codigo_postal", "localidade", "freguesia_id",
    ]  # fmt: skip

    def base_queryset(self):
        return Agencia.objects.select_related("tipo", "status", "freguesia__concelho__distrito", "responsavel")

    @extend_schema(parameters=[OpenApiParameter(n, str) for n in ("pesquisa", "tipo", "status", "categoria_status")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "tipos": opcoes_lista("tipos_agencia"),
                "status": opcoes_lista("status_agentes"),
                **self.permissoes_gerais(request),
            }
        )


class AgenteViewSet(_Lista, RegistoViewSet):
    modulo = "agentes"
    modelo = Agente
    nome_registo = "agente"
    serializer_class = AgenteSerializer
    campos_auditados = [*CONTACTOS, "agencia_id", "utilizador_id"]

    def base_queryset(self):
        return Agente.objects.select_related("tipo", "status", "agencia__tipo", "utilizador", "responsavel")

    def filtros_extra(self, qs, p):
        if p.get("agencia"):
            qs = qs.filter(agencia_id=p["agencia"])
        if p.get("tipo_agencia"):
            qs = qs.filter(agencia__tipo_id=p["tipo_agencia"])
        return qs

    def pesquisa_extra(self, termo) -> Q:
        return Q(agencia__nome__unaccent__icontains=termo)

    @extend_schema(
        parameters=[
            OpenApiParameter(n, str)
            for n in ("pesquisa", "tipo", "status", "categoria_status", "agencia", "tipo_agencia")
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        from apps.contas.models import Utilizador

        return Response(
            {
                "tipos": opcoes_lista("tipos_agente"),
                "status": opcoes_lista("status_agentes"),
                "tipos_agencia": opcoes_lista("tipos_agencia"),
                "utilizadores": list(Utilizador.objects.filter(is_active=True).order_by("nome").values("id", "nome")),
                **self.permissoes_gerais(request),
            }
        )
