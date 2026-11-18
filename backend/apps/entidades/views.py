from django.contrib.postgres.lookups import Unaccent  # noqa: F401  (regista o lookup)
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import PermissaoModulo, ambito_efetivo, filtrar, pode_no_registo
from apps.core.auditoria import registar
from apps.core.validacao import normalizar_telefone
from apps.core.vistas import valor_legivel

from .models import Entidade, RelacaoEntidade, TelefoneEntidade, TipoRelacao
from .serializers import (
    DuplicadosPedidoSerializer,
    EntidadeListaSerializer,
    EntidadeSerializer,
    RelacaoPedidoSerializer,
)
from .servicos import existem_outros_fortes, procurar_duplicados, tem_duplicado_forte

MODULO = "entidades"
ORDENACOES = {
    "nome": "nome_completo",
    "-nome": "-nome_completo",
    "recentes": "-criado_em",
    "referencia": "id",
}
CAMPOS_AUDITADOS = [
    "tipo_pessoa", "nome", "apelido", "pais_fiscal", "nif", "data_nascimento", "email", "rua", "numero_policia",
    "complemento", "codigo_postal", "localidade", "freguesia_id", "origem_id", "responsavel_id", "status_id",
    "quem_recomendou_id", "imovel_contacto_id", "visitou_imovel_contacto", "motivo_nao_visitou", "observacoes",
    "consentimento_marketing", "consentimento_marketing_em", "oposicao_marketing", "estado_civil_id",
    "regime_casamento_id", "nacionalidade", "documento_identificacao", "naturalidade_freguesia",
    "naturalidade_concelho", "empresa", "cargo", "observacoes_pessoais", "zona_comercial_id",
]  # fmt: skip


class ConflitoVersao(Exception):
    pass


def _fotografia(e: Entidade) -> dict:
    return {c: str(getattr(e, c)) if getattr(e, c) is not None else None for c in CAMPOS_AUDITADOS}


class EntidadeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    modulo = MODULO
    permission_classes = [PermissaoModulo]
    operacoes_extra = {
        "restaurar": Operacao.RESTAURAR,
        "lixeira": Operacao.RESTAURAR,
        "duplicados": Operacao.CONSULTAR,
        "historico": Operacao.CONSULTAR,
        "opcoes": Operacao.CONSULTAR,
        "relacoes": Operacao.CONSULTAR,
        "remover_relacao": Operacao.EDITAR,
        "imoveis": Operacao.CONSULTAR,
    }

    def get_serializer_class(self):
        return EntidadeListaSerializer if self.action == "list" else EntidadeSerializer

    def _operacao(self):
        from apps.contas.permissoes import OPERACAO_POR_ACAO

        return self.operacoes_extra.get(self.action) or OPERACAO_POR_ACAO.get(self.action, Operacao.CONSULTAR)

    def get_queryset(self):
        qs = Entidade.objects.select_related(
            "responsavel", "origem", "status", "quem_recomendou", "freguesia__concelho__distrito",
            "imovel_contacto__tipo", "imovel_contacto__tipologia", "estado_civil", "regime_casamento", "zona_comercial",
        )  # fmt: skip
        qs = qs.prefetch_related(
            "papeis", Prefetch("telefones", queryset=TelefoneEntidade.objects.order_by("-principal", "ordem"))
        )
        qs = qs.na_lixeira() if self.action in ("lixeira", "restaurar") else qs.ativos()
        qs = filtrar(self.request.user, MODULO, self._operacao(), qs, campo_partilhas="partilhada_com")
        if self.action == "list":
            qs = self._filtros(qs)
        return qs

    def _filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            digitos = "".join(c for c in termo if c.isdigit())
            cond = Q(nome_completo__unaccent__icontains=termo) | Q(email__icontains=termo)
            cond |= Q(referencia__iexact=termo)
            if len(digitos) >= 3:
                cond |= Q(nif__startswith=digitos) | Q(telefones__numero_e164__contains=digitos)
            qs = qs.filter(cond).distinct()
        if p.get("papel"):
            qs = qs.filter(papeis__id=p["papel"])
        if p.get("tipo_pessoa"):
            qs = qs.filter(tipo_pessoa=p["tipo_pessoa"])
        if p.get("status"):
            qs = qs.filter(status_id=p["status"])
        if p.get("responsavel"):
            qs = qs.filter(responsavel_id=p["responsavel"])
        return qs.order_by(ORDENACOES.get(p.get("ordenar", "nome"), "nome_completo"), "id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action in ("retrieve", "update", "partial_update", "create"):
            ctx["acoes"] = _AcoesCalculadas(self.request.user)
        return ctx

    @extend_schema(
        parameters=[
            OpenApiParameter("pesquisa", str),
            OpenApiParameter("papel", int),
            OpenApiParameter("tipo_pessoa", str),
            OpenApiParameter("status", int),
            OpenApiParameter("responsavel", int),
            OpenApiParameter("ordenar", str, enum=list(ORDENACOES)),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    # Criação / edição -----------------------------------------------------------

    def _validar_responsavel(self, novo, atual=None):
        """Atribuir a outro utilizador é uma transferência: exige permissão e âmbito."""
        u = self.request.user
        if novo is None or novo == (atual or u):
            return
        ambito = ambito_efetivo(u, MODULO, Operacao.TRANSFERIR)
        permitido = ambito == Ambito.TODOS or (
            ambito == Ambito.EQUIPA and u.equipa_id and novo.equipa_id == u.equipa_id
        )
        if not permitido:
            raise PermissionDenied("Não tem permissão para atribuir esta entidade a outro utilizador.")

    def _verificar_duplicados(self, dados, excluir_id=None):
        if dados.get("confirmar_duplicado"):
            return
        telefones = [t["numero_e164"] for t in dados.get("telefones") or []]
        candidatos, _ = procurar_duplicados(
            self.request.user,
            nif=dados.get("nif", ""),
            email=dados.get("email", ""),
            telefones=telefones,
            excluir_id=excluir_id,
        )
        outros = existem_outros_fortes(
            self.request.user,
            [c["id"] for c in candidatos],
            nif=dados.get("nif", ""),
            email=dados.get("email", ""),
            telefones=telefones,
            excluir_id=excluir_id,
        )
        if tem_duplicado_forte(candidatos, outros):
            raise _Duplicado(candidatos, outros)

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        self._validar_responsavel(s.validated_data.get("responsavel"))
        try:
            self._verificar_duplicados(s.validated_data)
        except _Duplicado as d:
            return d.resposta()
        e = s.save(
            responsavel=s.validated_data.get("responsavel") or request.user,
            criado_por=request.user,
            atualizado_por=request.user,
        )
        registar("entidade.criada", modulo=MODULO, objeto=e, request=request, descricao=e.nome_completo)
        if s.validated_data.get("confirmar_duplicado"):
            registar("entidade.duplicado_confirmado", modulo=MODULO, objeto=e, request=request)
        return Response(self.get_serializer(self._recarregar(e)).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        with transaction.atomic():
            e = self.get_object()
            e = Entidade.objects.select_for_update().get(pk=e.pk)
            versao = request.data.get("versao")
            if versao is None:
                raise serializers.ValidationError({"versao": "Campo obrigatório."})
            if int(versao) != e.versao:
                return Response(
                    {
                        "detail": "Esta entidade foi alterada por outra pessoa entretanto. "
                        "Recarregue a ficha antes de gravar.",
                        "codigo": "conflito_versao",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            s = self.get_serializer(e, data=request.data, partial=parcial)
            s.is_valid(raise_exception=True)
            responsavel_antes = e.responsavel
            self._validar_responsavel(s.validated_data.get("responsavel"), atual=responsavel_antes)
            alterou_contactos = any(k in s.validated_data for k in ("nif", "email", "telefones"))
            if alterou_contactos:
                try:
                    self._verificar_duplicados(s.validated_data, excluir_id=e.pk)
                except _Duplicado as d:
                    return d.resposta()
            antes = _fotografia(e)
            e = s.save(atualizado_por=request.user)
            depois = _fotografia(e)
            alteracoes = {c: [antes[c], depois[c]] for c in CAMPOS_AUDITADOS if antes[c] != depois[c]}
            registar("entidade.alterada", modulo=MODULO, objeto=e, request=request, dados=alteracoes)
            if e.responsavel != responsavel_antes:
                registar(
                    "entidade.transferida",
                    modulo=MODULO,
                    objeto=e,
                    request=request,
                    dados={"de": responsavel_antes.pk, "para": e.responsavel.pk},
                )
        return Response(self.get_serializer(self._recarregar(e)).data)

    def _recarregar(self, e):
        return (
            Entidade.objects.select_related("responsavel", "origem", "freguesia__concelho__distrito")
            .prefetch_related("papeis", "telefones")
            .get(pk=e.pk)
        )

    # Lixeira ------------------------------------------------------------------

    def destroy(self, request, *args, **kwargs):
        e = self.get_object()
        e.enviar_para_lixeira(request.user)
        registar("entidade.lixeira", modulo=MODULO, objeto=e, request=request, descricao=e.nome_completo)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def lixeira(self, request):
        return super().list(request)

    @action(detail=True, methods=["post"])
    def restaurar(self, request, pk=None):
        e = self.get_object()
        e.restaurar(request.user)
        registar("entidade.restaurada", modulo=MODULO, objeto=e, request=request)
        return Response(self.get_serializer(self._recarregar(e)).data)

    # Apoio --------------------------------------------------------------------

    @extend_schema(request=DuplicadosPedidoSerializer)
    @action(detail=False, methods=["post"])
    def duplicados(self, request):
        """Verificação prévia de duplicados (usada enquanto se preenche o formulário)."""
        s = DuplicadosPedidoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        telefones = []
        for t in d.get("telefones", []):
            try:
                telefones.append(normalizar_telefone(t.get("regiao", "PT"), str(t.get("numero", ""))))
            except DjangoValidationError:
                pass
        candidatos, outros = procurar_duplicados(
            request.user,
            nif=d.get("nif", ""),
            email=d.get("email", ""),
            telefones=telefones,
            nome=d.get("nome", ""),
            excluir_id=d.get("excluir_id"),
        )
        return Response({"candidatos": candidatos, "outros": outros})

    @action(detail=True, methods=["get"])
    def historico(self, request, pk=None):
        e = self.get_object()
        registos = e.historico.select_related("history_user").order_by("-history_date")[:100]
        resultado = []
        for h in registos:
            alteracoes = []
            if h.prev_record:
                delta = h.diff_against(h.prev_record)
                alteracoes = [
                    {
                        "campo": c.field,
                        "antes": valor_legivel(Entidade, c.field, c.old),
                        "depois": valor_legivel(Entidade, c.field, c.new),
                    }
                    for c in delta.changes
                    if c.field not in ("versao", "atualizado_em", "atualizado_por")
                ]
            resultado.append(
                {
                    "momento": h.history_date,
                    "tipo": {"+": "criação", "~": "alteração", "-": "eliminação"}[h.history_type],
                    "utilizador": h.history_user.nome if h.history_user else None,
                    "alteracoes": alteracoes,
                }
            )
        return Response(resultado)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        """Listas de valores para os formulários."""
        return Response(
            {
                "papeis": opcoes_lista("papeis_entidade"),
                "origens": opcoes_lista("origens_contacto"),
                "status": opcoes_lista("status_entidade"),
                "estados_civis": opcoes_lista("estados_civis"),
                "regimes_casamento": opcoes_lista("regimes_casamento"),
                "zonas_comerciais": opcoes_lista("zonas_comerciais"),
                "tipos_pessoa": [{"valor": v, "nome": n} for v, n in Entidade.TipoPessoa.choices],
                "consentimentos": [{"valor": v, "nome": n} for v, n in Entidade.Consentimento.choices],
                "tipos_telefone": [{"valor": v, "nome": n} for v, n in TelefoneEntidade.Tipo.choices],
                "tipos_relacao": list(
                    TipoRelacao.objects.filter(ativo=True).values("id", "nome", "nome_inverso", "simetrica")
                ),
                "pode_criar": PermissaoModulo().has_permission(request, _Vista("create")),
                "pode_transferir": ambito_efetivo(request.user, MODULO, Operacao.TRANSFERIR) != Ambito.NENHUM,
                "pode_restaurar": ambito_efetivo(request.user, MODULO, Operacao.RESTAURAR) != Ambito.NENHUM,
            }
        )

    # Relações entre entidades -----------------------------------------------------

    def _visiveis(self):
        return filtrar(
            self.request.user,
            MODULO,
            Operacao.CONSULTAR,
            Entidade.objects.ativos(),
            campo_partilhas="partilhada_com",
        )

    def _listar_relacoes(self, e):
        rels = RelacaoEntidade.objects.filter(Q(origem=e) | Q(destino=e)).select_related("tipo", "origem", "destino")
        visiveis = set(
            self._visiveis()
            .filter(pk__in=[r.destino_id if r.origem_id == e.pk else r.origem_id for r in rels])
            .values_list("pk", flat=True)
        )
        resultado = []
        for r in rels:
            direta = r.origem_id == e.pk
            outra = r.destino if direta else r.origem
            acessivel = outra.pk in visiveis
            resultado.append(
                {
                    "id": r.id,
                    "tipo": r.tipo_id,
                    "rotulo": r.tipo.nome if direta else r.tipo.nome_inverso,
                    "acessivel": acessivel,
                    # Respeitar as permissões das duas pontas: sem acesso, não revelar dados.
                    "entidade": {
                        "id": outra.pk,
                        "referencia": outra.referencia,
                        "nome_completo": outra.nome_completo,
                        "tipo_pessoa": outra.tipo_pessoa,
                        "data_nascimento": outra.data_nascimento,
                    }
                    if acessivel
                    else None,
                    "observacoes": r.observacoes if acessivel else "",
                }
            )
        return resultado

    @extend_schema(request=RelacaoPedidoSerializer)
    @action(detail=True, methods=["get", "post"])
    def relacoes(self, request, pk=None):
        e = self.get_object()
        if request.method == "GET":
            return Response(self._listar_relacoes(e))
        if not pode_no_registo(request.user, MODULO, Operacao.EDITAR, e, campo_partilhas="partilhada_com"):
            raise PermissionDenied("Não tem permissão para alterar esta entidade.")
        s = RelacaoPedidoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        outra = self._visiveis().filter(pk=d["entidade"]).first()
        if outra is None:
            raise serializers.ValidationError({"entidade": "Entidade inexistente ou sem acesso."})
        if outra.pk == e.pk:
            raise serializers.ValidationError({"entidade": "Uma entidade não se pode relacionar consigo própria."})
        tipo = TipoRelacao.objects.filter(pk=d["tipo"], ativo=True).first()
        if tipo is None:
            raise serializers.ValidationError({"tipo": "Tipo de relação inválido."})
        origem, destino = (outra, e) if d["sentido"] == "inverso" and not tipo.simetrica else (e, outra)
        existe = RelacaoEntidade.objects.filter(tipo=tipo, origem=origem, destino=destino)
        if tipo.simetrica:
            existe = RelacaoEntidade.objects.filter(tipo=tipo).filter(
                Q(origem=e, destino=outra) | Q(origem=outra, destino=e)
            )
        if existe.exists():
            raise serializers.ValidationError({"entidade": "Esta relação já existe."})
        nascimento = d.get("data_nascimento")
        if nascimento and nascimento != outra.data_nascimento:
            if outra.tipo_pessoa != Entidade.TipoPessoa.SINGULAR:
                raise serializers.ValidationError({"data_nascimento": "Não aplicável a pessoas coletivas."})
            if not pode_no_registo(request.user, MODULO, Operacao.EDITAR, outra, campo_partilhas="partilhada_com"):
                raise serializers.ValidationError(
                    {"data_nascimento": "Não tem permissão para alterar a data de nascimento desta entidade."}
                )
        r = RelacaoEntidade.objects.create(
            origem=origem, destino=destino, tipo=tipo, observacoes=d.get("observacoes", ""), criado_por=request.user
        )
        if nascimento and nascimento != outra.data_nascimento:
            antes = outra.data_nascimento
            outra.data_nascimento = nascimento
            outra.save()
            registar(
                "entidade.alterada",
                modulo=MODULO,
                objeto=outra,
                request=request,
                dados={"data_nascimento": [_texto(antes), _texto(nascimento)]},
            )
        registar(
            "entidade.relacao_criada",
            modulo=MODULO,
            objeto=e,
            request=request,
            dados={"relacao": r.pk, "tipo": tipo.nome, "origem": origem.pk, "destino": destino.pk},
        )
        return Response(self._listar_relacoes(e), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"relacoes/(?P<relacao_id>\d+)")
    def remover_relacao(self, request, pk=None, relacao_id=None):
        e = self.get_object()
        r = RelacaoEntidade.objects.filter(Q(origem=e) | Q(destino=e), pk=relacao_id).select_related("tipo").first()
        if r is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        dados = {"relacao": r.pk, "tipo": r.tipo.nome, "origem": r.origem_id, "destino": r.destino_id}
        r.delete()
        registar("entidade.relacao_removida", modulo=MODULO, objeto=e, request=request, dados=dados)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def imoveis(self, request, pk=None):
        """Imóveis de que a entidade é proprietária (titularidade atual), com a quota.
        Imóveis a que o utilizador não tem acesso só são contados."""
        from apps.imoveis.models import Imovel, Proprietario

        e = self.get_object()
        props = Proprietario.objects.filter(entidade=e, imovel__eliminado_em__isnull=True).select_related(
            "imovel__tipo", "imovel__tipologia", "imovel__estado_comercializacao", "imovel__status"
        )
        visiveis = set(
            filtrar(
                request.user,
                "imoveis",
                Operacao.CONSULTAR,
                Imovel.objects.filter(pk__in=[p.imovel_id for p in props]),
                campo_partilhas="partilhada_com",
            ).values_list("pk", flat=True)
        )
        lista = [
            {
                "id": p.imovel.pk,
                "referencia": p.imovel.referencia,
                "tipo": p.imovel.tipo.nome if p.imovel.tipo else None,
                "tipologia": p.imovel.tipologia.nome if p.imovel.tipologia else None,
                "localidade": p.imovel.localidade,
                "estado_comercializacao": p.imovel.estado_comercializacao.nome
                if p.imovel.estado_comercializacao
                else None,
                "status": p.imovel.status.nome if p.imovel.status else None,
                "status_categoria": p.imovel.status.categoria if p.imovel.status else None,
                "quota": str(p.quota) if p.quota is not None else None,
            }
            for p in props
            if p.imovel_id in visiveis
        ]
        return Response({"imoveis": lista, "outros": len(props) - len(lista)})


def _texto(v):
    return None if v is None else str(v)


class _Vista:
    modulo = MODULO

    def __init__(self, acao):
        self.action = acao


class _AcoesCalculadas(dict):
    """Ações permitidas por registo, calculadas no servidor (a interface só as reflete)."""

    def __init__(self, utilizador):
        super().__init__()
        self.u = utilizador

    def get(self, pk, default=None):
        if pk not in self:
            e = Entidade.objects.get(pk=pk)
            kw = {"campo_partilhas": "partilhada_com"}
            self[pk] = {
                "editar": pode_no_registo(self.u, MODULO, Operacao.EDITAR, e, **kw),
                "eliminar": pode_no_registo(self.u, MODULO, Operacao.ELIMINAR, e, **kw),
                "transferir": pode_no_registo(self.u, MODULO, Operacao.TRANSFERIR, e, **kw),
            }
        return super().get(pk, default)


class _Duplicado(Exception):
    def __init__(self, candidatos, outros):
        self.candidatos, self.outros = candidatos, outros

    def resposta(self):
        return Response(
            {
                "detail": "Já existe uma entidade com o mesmo NIF, email ou telefone.",
                "codigo": "possivel_duplicado",
                "candidatos": self.candidatos,
                "outros": self.outros,
            },
            status=status.HTTP_409_CONFLICT,
        )
