from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.configuracao.models import ValorLista
from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar, pode
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.models import Imovel, Proprietario
from apps.imoveis.views import entidades_visiveis

from .models import Oportunidade
from .serializers import ConverterSerializer, OportunidadeListaSerializer, OportunidadeSerializer


def imoveis_visiveis(utilizador) -> set[int]:
    qs = filtrar(utilizador, "imoveis", Operacao.CONSULTAR, Imovel.objects.ativos(), campo_partilhas="partilhada_com")
    return set(qs.values_list("pk", flat=True))


class OportunidadeViewSet(RegistoViewSet):
    modulo = "oportunidades"
    modelo = Oportunidade
    nome_registo = "oportunidade"
    operacoes_extra = {**RegistoViewSet.operacoes_extra, "converter": Operacao.EDITAR}
    campos_auditados = [
        "entidade_id", "imovel_id", "tipo_imovel_id", "tipologia_id", "localidade", "descricao_imovel",
        "operacao_id", "estado_id", "qualificacao", "origem_id", "motivacao", "preco_pretendido", "prazo",
        "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return OportunidadeListaSerializer if self.action == "list" else OportunidadeSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        ctx["imoveis_visiveis"] = imoveis_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Oportunidade.objects.select_related(
            "entidade", "imovel__tipo", "imovel__tipologia", "tipo_imovel", "tipologia", "operacao", "estado",
            "origem", "responsavel", "angariacao_gerada",
        )  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(entidade__nome_completo__unaccent__icontains=termo)
                | Q(localidade__unaccent__icontains=termo)
                | Q(descricao_imovel__unaccent__icontains=termo)
                | Q(imovel__referencia__iexact=termo)
            )
        if p.get("estado"):
            qs = qs.filter(estado_id=p["estado"])
        if p.get("categoria"):
            qs = qs.filter(estado__categoria=p["categoria"])
        if p.get("qualificacao"):
            qs = qs.filter(qualificacao=p["qualificacao"])
        if p.get("entidade"):
            qs = qs.filter(entidade_id=p["entidade"])
        return qs.order_by("-criado_em", "-id")

    @extend_schema(
        parameters=[OpenApiParameter(n, str) for n in ("pesquisa", "estado", "categoria", "qualificacao", "entidade")]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "estados": opcoes_lista("estados_oportunidade"),
                "operacoes": opcoes_lista("operacoes"),
                "origens": opcoes_lista("origens_contacto"),
                "tipos_imovel": opcoes_lista("tipos_imovel"),
                "tipologias": opcoes_lista("tipologias"),
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                "qualificacoes": [{"valor": v, "nome": n} for v, n in Oportunidade.Qualificacao.choices],
                **self.permissoes_gerais(request),
            }
        )

    @extend_schema(request=ConverterSerializer)
    @action(detail=True, methods=["post"])
    def converter(self, request, pk=None):
        """Passagem expressa e auditada a Imóvel (se ainda não existir) e, opcionalmente, a um CMI
        por assinar. Não altera o estado da oportunidade (decisão do utilizador)."""
        from apps.angariacoes.models import Angariacao, Interveniente

        s = ConverterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        criar_cmi = s.validated_data["criar_cmi"]
        u = request.user
        with transaction.atomic():
            o = Oportunidade.objects.select_for_update().get(pk=self.get_object().pk)
            if criar_cmi and o.angariacao_gerada_id:
                return Response(
                    {
                        "detail": f"Esta oportunidade já deu origem ao CMI {o.angariacao_gerada.referencia}.",
                        "codigo": "ja_convertida",
                    },  # fmt: skip
                    status=status.HTTP_409_CONFLICT,
                )
            if not o.imovel_id and not pode(u, "imoveis", Operacao.CRIAR):
                raise PermissionDenied("Não tem permissão para criar imóveis.")
            if criar_cmi and not pode(u, "angariacoes", Operacao.CRIAR):
                raise PermissionDenied("Não tem permissão para criar angariações.")
            criado = None
            if o.imovel_id is None:
                if not (o.operacao or o.tipo_imovel or o.localidade or o.descricao_imovel):
                    raise serializers.ValidationError(
                        {"detail": "Descreva o imóvel (tipo, localidade ou descrição) antes de o criar."}
                    )
                criado = Imovel.objects.create(
                    tipo=o.tipo_imovel,
                    tipologia=o.tipologia,
                    localidade=o.localidade,
                    operacao=o.operacao,
                    preco=o.preco_pretendido,
                    descricao=o.descricao_imovel,
                    status=ValorLista.objects.filter(lista__chave="status_imovel", categoria="ativo", ativo=True)
                    .order_by("ordem")
                    .first(),
                    responsavel=o.responsavel,
                    criado_por=u,
                    atualizado_por=u,
                )
                Proprietario.objects.create(imovel=criado, entidade=o.entidade)
                o.imovel = criado
            cmi = None
            if criar_cmi:
                cmi = Angariacao.objects.create(
                    imovel=o.imovel,
                    operacao=o.operacao or o.imovel.operacao,
                    responsavel=o.responsavel,
                    criado_por=u,
                    atualizado_por=u,
                )
                papel = ValorLista.objects.filter(
                    lista__chave="papeis_interveniente_cmi", nome="Proprietário", ativo=True
                ).first()
                for ordem, p in enumerate(o.imovel.proprietarios.all()):
                    Interveniente.objects.create(
                        angariacao=cmi, entidade_id=p.entidade_id, papel=papel, quota=p.quota, ordem=ordem
                    )
                o.angariacao_gerada = cmi
            o.atualizado_por = u
            o.save()
            registar(
                "oportunidade.convertida",
                modulo=self.modulo,
                objeto=o,
                request=request,
                dados={
                    "imovel_criado": criado.pk if criado else None,
                    "imovel": o.imovel_id,
                    "cmi": cmi.pk if cmi else None,
                },  # fmt: skip
            )
        return Response(
            {
                "imovel": o.imovel_id,
                "imovel_referencia": o.imovel.referencia,
                "imovel_criado": criado is not None,
                "angariacao": cmi.pk if cmi else None,
                "angariacao_referencia": cmi.referencia if cmi else None,
            }
        )
