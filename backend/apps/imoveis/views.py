import re
import uuid
from decimal import Decimal, InvalidOperation

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Prefetch, Q
from django.http import FileResponse, Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Operacao
from apps.contas.permissoes import Ambito, ambito_efetivo, filtrar, pode_no_registo
from apps.core.armazenamento import armazenamento_privado
from apps.core.auditoria import registar
from apps.core.imagens import ImagemInvalida, processar_fotografia
from apps.core.vistas import RegistoViewSet
from apps.entidades.models import Entidade

from .models import Imovel, Proprietario
from .serializers import CAMPOS_D34, LISTAS_D34, ImovelListaSerializer, ImovelSerializer

ORDENACOES = {
    "recentes": "-criado_em",
    "referencia": "id",
    "preco": "preco",
    "-preco": "-preco",
}
LISTAS = {  # nome na resposta -> chave da lista
    "tipos": "tipos_imovel",
    "tipologias": "tipologias",
    "estados_comercializacao": "estados_comercializacao",
    "condicoes_fisicas": "condicoes_fisicas",
    "zonas_comerciais": "zonas_comerciais",
    "certificados_energeticos": "certificados_energeticos",
    "zonas_exteriores": "zonas_exteriores",
    **{chave: chave for chave in LISTAS_D34.values()},
}


def entidades_visiveis(utilizador) -> set[int]:
    qs = filtrar(
        utilizador, "entidades", Operacao.CONSULTAR, Entidade.objects.ativos(), campo_partilhas="partilhada_com"
    )
    return set(qs.values_list("pk", flat=True))


def condicao_pesquisa(palavra: str) -> Q:
    return (
        Q(referencia__icontains=palavra)
        | Q(tipo__nome__unaccent__icontains=palavra)
        | Q(tipologia__nome__unaccent__icontains=palavra)
        | Q(rua__unaccent__icontains=palavra)
        | Q(localidade__unaccent__icontains=palavra)
        | Q(localizacao_descritiva__unaccent__icontains=palavra)
        | Q(zona_comercial__nome__unaccent__icontains=palavra)
        | Q(freguesia__nome__unaccent__icontains=palavra)
        | Q(freguesia__concelho__nome__unaccent__icontains=palavra)
        | Q(descricao__unaccent__icontains=palavra)
        | Q(proprietarios__entidade__nome_completo__unaccent__icontains=palavra)
    )


class ImovelViewSet(RegistoViewSet):
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "fotografia": Operacao.CONSULTAR,
        "angariacoes": Operacao.CONSULTAR,
        "procuras_compativeis": Operacao.CONSULTAR,
        "duplicar": Operacao.CONSULTAR,  # e, além disso, permissão para criar (verificada na ação)
    }
    modulo = "imoveis"
    modelo = Imovel
    nome_registo = "imovel"
    campos_auditados = [
        "tipo_id", "tipologia_id", "estado_comercializacao_id", "condicao_fisica_id", "preco",
        "rua", "numero_policia", "complemento", "codigo_postal", "localidade", "freguesia_id", "zona_comercial_id",
        "localizacao_descritiva", "area_bruta_privativa", "area_bruta_dependente", "area_util", "area_terreno",
        "quartos", "casas_banho", "ano_construcao", "piso", "elevador", "lugares_estacionamento",
        "certificado_energetico_id", "descricao", "responsavel_id", "observacoes", "operacao_id", "status_id",
        *[f"{c}_id" for c in LISTAS_D34], *CAMPOS_D34,
    ]  # fmt: skip

    def get_serializer_class(self):
        return ImovelListaSerializer if self.action == "list" else ImovelSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Imovel.objects.select_related(
            "tipo", "tipologia", "estado_comercializacao", "operacao", "status", "condicao_fisica", "zona_comercial",
            "certificado_energetico", "responsavel", "freguesia__concelho__distrito", *LISTAS_D34,
        ).prefetch_related(
            "zonas_exteriores",
            Prefetch("proprietarios", queryset=Proprietario.objects.select_related("entidade")),
        )  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            # Pesquisa flexível (D-34): cada palavra tem de aparecer em algum dos campos,
            # por qualquer ordem. Ex.: «10 T3 Maia» encontra IMV-000010, T3, na Maia.
            for palavra in re.split(r"[\s,;]+", termo):
                if palavra:
                    qs = qs.filter(condicao_pesquisa(palavra))
            qs = qs.distinct()
        for parametro, campo in (
            ("tipo", "tipo_id"),
            ("tipologia", "tipologia_id"),
            ("estado_comercializacao", "estado_comercializacao_id"),
            ("operacao", "operacao_id"),
            ("responsavel", "responsavel_id"),
        ):
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        # Por omissão não se mostram os arquivados.
        status_ = p.get("status")
        qs = qs.filter(status_id=status_) if status_ else qs.exclude(status__categoria="arquivado")
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
                "operacoes": opcoes_lista("operacoes"),
                "status": opcoes_lista("status_imovel"),
                **self.permissoes_gerais(request),
            }
        )

    # Fotografia principal (uma por imóvel) ---------------------------------------------

    @extend_schema(
        methods=["GET"],
        parameters=[OpenApiParameter("tamanho", str, enum=["normal", "miniatura"])],
        responses={(200, "image/webp"): OpenApiTypes.BINARY},
    )
    @extend_schema(methods=["POST"], request={"multipart/form-data": {"type": "object", "properties": {
        "ficheiro": {"type": "string", "format": "binary"}}}})  # fmt: skip
    @action(detail=True, methods=["get", "post", "delete"], parser_classes=[MultiPartParser])
    def fotografia(self, request, pk=None):
        imovel = self.get_object()
        if request.method == "GET":
            campo = (
                imovel.fotografia_miniatura if request.query_params.get("tamanho") == "miniatura" else imovel.fotografia
            )
            if not campo:
                raise Http404
            resposta = FileResponse(campo.open("rb"), content_type="image/webp")
            # Ficheiro privado: o browser pode guardá-lo, mas nunca caches partilhadas.
            resposta["Cache-Control"] = "private, max-age=86400"
            return resposta
        if not pode_no_registo(request.user, self.modulo, Operacao.EDITAR, imovel, campo_partilhas="partilhada_com"):
            raise PermissionDenied("Não tem permissão para alterar este imóvel.")
        antigos = [imovel.fotografia.name, imovel.fotografia_miniatura.name]
        if request.method == "DELETE":
            imovel.fotografia = imovel.fotografia_miniatura = ""
            acao = "imovel.fotografia_removida"
        else:
            ficheiro = request.FILES.get("ficheiro")
            if ficheiro is None:
                raise ValidationError({"ficheiro": "Escolha uma imagem."})
            try:
                principal, miniatura = processar_fotografia(ficheiro)
            except ImagemInvalida as e:
                raise ValidationError({"ficheiro": str(e)}) from e
            sufixo = uuid.uuid4().hex[:12]
            imovel.fotografia.save(f"foto-{sufixo}.webp", principal, save=False)
            imovel.fotografia_miniatura.save(f"mini-{sufixo}.webp", miniatura, save=False)
            acao = "imovel.fotografia_alterada"
        imovel.atualizado_por = request.user
        imovel.save()
        # Apaga os ficheiros substituídos (o registo do histórico mantém o nome).
        for nome in antigos:
            if nome:
                armazenamento_privado.delete(nome)
        registar(acao, modulo=self.modulo, objeto=imovel, request=request)
        return Response(self.get_serializer(self.recarregar(imovel)).data)

    # Campos que NÃO passam para a cópia.
    NAO_DUPLICAR = {
        "id", "referencia", "versao", "criado_em", "criado_por", "atualizado_em", "atualizado_por",
        "eliminado_em", "eliminado_por", "fotografia", "fotografia_miniatura", "duplicado_de", "responsavel",
        "estado_comercializacao", "status",
    }  # fmt: skip

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def duplicar(self, request, pk=None):
        """D-35: nova comercialização do mesmo imóvel (vendido, cancelado ou rescindido que volta ao
        mercado). Cria um imóvel novo com as mesmas características, proprietários e fotografia, para
        depois se atualizar o que mudou. O original fica intacto, com o seu histórico e contratos."""
        original = self.get_object()
        if not request.data.get("confirmar"):
            raise ValidationError({"confirmar": "É necessário confirmar a duplicação."})
        if ambito_efetivo(request.user, self.modulo, Operacao.CRIAR) == Ambito.NENHUM:
            raise PermissionDenied("Não tem permissão para criar imóveis.")
        dados = {
            f.attname: getattr(original, f.attname)
            for f in Imovel._meta.concrete_fields
            if f.name not in self.NAO_DUPLICAR and f.attname not in self.NAO_DUPLICAR
        }
        from apps.configuracao.models import ValorLista

        novo = Imovel(
            **dados,
            duplicado_de=original,
            responsavel=request.user,
            criado_por=request.user,
            atualizado_por=request.user,
            estado_comercializacao=ValorLista.objects.filter(
                lista__chave="estados_comercializacao", categoria="preparacao", ativo=True
            )
            .order_by("ordem", "id")
            .first(),
            status=ValorLista.objects.filter(lista__chave="status_imovel", categoria="ativo", ativo=True)
            .order_by("ordem", "id")
            .first(),
        )
        novo.save()
        novo.zonas_exteriores.set(original.zonas_exteriores.all())
        for p in original.proprietarios.all():
            Proprietario.objects.create(imovel=novo, entidade_id=p.entidade_id, quota=p.quota)
        if original.fotografia:
            sufixo = uuid.uuid4().hex[:12]
            with original.fotografia.open("rb") as f:
                novo.fotografia.save(f"foto-{sufixo}.webp", ContentFile(f.read()), save=False)
            with original.fotografia_miniatura.open("rb") as f:
                novo.fotografia_miniatura.save(f"mini-{sufixo}.webp", ContentFile(f.read()), save=False)
            Imovel.objects.filter(pk=novo.pk).update(
                fotografia=novo.fotografia.name, fotografia_miniatura=novo.fotografia_miniatura.name
            )
        registar(
            "imovel.duplicado", modulo=self.modulo, objeto=novo, request=request,
            descricao=f"Duplicado de {original.referencia}", dados={"original": original.pk},
        )  # fmt: skip
        return Response({"id": novo.pk, "referencia": novo.referencia}, status=201)

    @action(detail=True, methods=["get"])
    def angariacoes(self, request, pk=None):
        """CMI deste imóvel a que o utilizador tem acesso (os restantes só são contados)."""
        from apps.angariacoes.models import ESTADOS, Angariacao
        from apps.angariacoes.servicos import alerta, hoje

        imovel = self.get_object()
        todos = Angariacao.objects.ativos().filter(imovel=imovel).select_related("regime", "operacao")
        visiveis = filtrar(request.user, "angariacoes", Operacao.CONSULTAR, todos, campo_partilhas="partilhada_com")
        dia = hoje()
        lista = [
            {
                "id": a.id,
                "referencia": a.referencia,
                "regime": a.regime.nome if a.regime else None,
                "operacao": a.operacao.nome if a.operacao else None,
                "data_inicio": a.data_inicio,
                "data_fim_vigente": a.data_fim_vigente,
                "estado": a.estado(dia),
                "estado_nome": ESTADOS[a.estado(dia)],
                "alerta": alerta(a, dia),
            }
            for a in visiveis.order_by("-data_inicio", "-id")
        ]
        return Response({"angariacoes": lista, "outros": todos.count() - len(lista)})

    @action(detail=True, methods=["get"], url_path="procuras-compativeis")
    def procuras_compativeis(self, request, pk=None):
        from apps.procuras.correspondencias import procuras_do_imovel

        return Response(procuras_do_imovel(self.get_object(), request.user))
