"""Módulo Equipa (Especificação Cap. 26, F2-05, D-41).

Os membros da Equipa são as contas individuais de acesso (utilizadores) com os seus dados profissionais.
Só quem tem âmbito «todos» no módulo `equipa` (por omissão o Administrador) cria e altera membros, perfis e
palavras-passe. Todos consultam a lista (para escolher responsáveis).
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.auditoria import registar
from apps.core.validacao import nif_valido, normalizar_telefone

from . import mfa
from .models import Ambito, Equipa, Operacao, Perfil, Utilizador
from .permissoes import ambito_efetivo

MODULO = "equipa"
OPERACOES = {"GET": Operacao.CONSULTAR, "POST": Operacao.CRIAR, "PATCH": Operacao.EDITAR, "PUT": Operacao.EDITAR}


def _exigir(request, operacao):
    amb = ambito_efetivo(request.user, MODULO, operacao)
    if operacao == Operacao.CONSULTAR:
        if amb == Ambito.NENHUM:
            raise PermissionDenied("Não tem acesso à Equipa.")
    elif amb != Ambito.TODOS:
        raise PermissionDenied("Só o Administrador gere a Equipa.")


class MembroSerializer(serializers.ModelSerializer):
    perfil_nome = serializers.CharField(source="get_perfil_display", read_only=True)
    equipa_nome = serializers.CharField(source="equipa.nome", read_only=True, default=None)
    equipa = serializers.PrimaryKeyRelatedField(queryset=Equipa.objects.all(), allow_null=True, required=False)
    ativo = serializers.BooleanField(source="is_active", required=False)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    mfa_ativa = serializers.SerializerMethodField()
    ultimo_acesso = serializers.DateTimeField(source="last_login", read_only=True)

    class Meta:
        model = Utilizador
        fields = [
            "id", "nome", "email", "perfil", "perfil_nome", "equipa", "equipa_nome", "funcao_comercial",
            "identificacao_profissional", "nif", "telefone", "telefone_e164", "ativo", "password", "mfa_ativa",
            "ultimo_acesso", "date_joined",
        ]  # fmt: skip
        read_only_fields = ["telefone_e164", "date_joined"]

    def get_mfa_ativa(self, o) -> bool:
        return mfa.mfa_ativa(o)

    def validate_nome(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("O nome é obrigatório.")
        return v

    def validate_email(self, v):
        v = v.strip().lower()
        outros = Utilizador.objects.filter(email__iexact=v)
        if self.instance:
            outros = outros.exclude(pk=self.instance.pk)
        if outros.exists():
            raise serializers.ValidationError("Já existe um membro com este email.")
        return v

    def validate(self, d):
        pedido = self.context["request"]
        nif = "".join((d.get("nif") or "").split())
        if "nif" in d:
            d["nif"] = nif
        if nif and nif.isdigit() and len(nif) == 9 and not nif_valido(nif):
            raise serializers.ValidationError({"nif": "NIF inválido."})
        if "telefone" in d:
            numero = (d.get("telefone") or "").strip()
            d["telefone"] = numero
            try:
                d["telefone_e164"] = normalizar_telefone("PT", numero) if numero else ""
            except DjangoValidationError as e:
                raise serializers.ValidationError({"telefone": e.messages}) from e
        if self.instance is None and not d.get("password"):
            raise serializers.ValidationError({"password": "Indique uma palavra-passe inicial."})
        if d.get("password"):
            try:
                validate_password(d["password"], user=self.instance)
            except DjangoValidationError as e:
                raise serializers.ValidationError({"password": e.messages}) from e
        # Evitar que um Administrador fique sem acesso por engano.
        if self.instance is not None and self.instance.pk == pedido.user.pk:
            if d.get("is_active") is False:
                raise serializers.ValidationError({"ativo": "Não pode desativar a sua própria conta."})
            if d.get("perfil") and d["perfil"] != self.instance.perfil:
                raise serializers.ValidationError({"perfil": "Não pode mudar o seu próprio perfil."})
        return d

    def create(self, d):
        password = d.pop("password")
        return Utilizador.objects.create_user(password=password, **d)

    def update(self, o, d):
        password = d.pop("password", None)
        for k, v in d.items():
            setattr(o, k, v)
        if password:
            o.set_password(password)
        o.save()
        return o


AUDITADOS = [
    "nome", "email", "perfil", "equipa_id", "funcao_comercial", "identificacao_profissional", "nif", "telefone",
    "is_active",
]  # fmt: skip


class MembroViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                    mixins.UpdateModelMixin, viewsets.GenericViewSet):  # fmt: skip
    serializer_class = MembroSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        _exigir(request, OPERACOES.get(request.method, Operacao.EDITAR))

    def get_queryset(self):
        qs = Utilizador.objects.select_related("equipa").order_by("nome", "id")
        if self.action != "list":
            return qs
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(Q(nome__unaccent__icontains=termo) | Q(email__icontains=termo))
        if p.get("equipa"):
            qs = qs.filter(equipa_id=p["equipa"])
        if p.get("perfil"):
            qs = qs.filter(perfil=p["perfil"])
        if p.get("ativo") in ("true", "false"):
            qs = qs.filter(is_active=p["ativo"] == "true")
        return qs

    def perform_create(self, s):
        u = s.save()
        registar("equipa.membro_criado", modulo=MODULO, objeto=u, request=self.request, descricao=u.nome)

    def perform_update(self, s):
        antes = {c: getattr(s.instance, c) for c in AUDITADOS}
        u = s.save()
        mudou = {c: [str(antes[c]), str(getattr(u, c))] for c in AUDITADOS if antes[c] != getattr(u, c)}
        if "password" in self.request.data:
            mudou["password"] = ["—", "alterada"]
        registar("equipa.membro_alterado", modulo=MODULO, objeto=u, request=self.request, dados=mudou)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "perfis": [{"valor": v, "nome": n} for v, n in Perfil.choices],
                "equipas": list(Equipa.objects.filter(ativa=True).values("id", "nome")),
                "pode_gerir": ambito_efetivo(request.user, MODULO, Operacao.EDITAR) == Ambito.TODOS,
            }
        )

    @action(detail=True, methods=["post"])
    def repor_mfa(self, request, pk=None):
        """Apaga a configuração de dois passos do membro (ex.: perdeu o telemóvel)."""
        u = self.get_object()
        mfa.desativar(u)
        registar("equipa.mfa_reposta", modulo=MODULO, objeto=u, request=request)
        return Response(self.get_serializer(u).data)


class EquipaSerializer(serializers.ModelSerializer):
    n_membros = serializers.SerializerMethodField()

    class Meta:
        model = Equipa
        fields = ["id", "nome", "ativa", "n_membros"]

    def get_n_membros(self, o) -> int:
        return o.membros.filter(is_active=True).count()


class EquipaViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin,
                    viewsets.GenericViewSet):  # fmt: skip
    serializer_class = EquipaSerializer
    permission_classes = [IsAuthenticated]
    queryset = Equipa.objects.order_by("nome")
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        _exigir(request, OPERACOES.get(request.method, Operacao.EDITAR))

    def perform_create(self, s):
        e = s.save()
        registar("equipa.equipa_criada", modulo=MODULO, objeto=e, request=self.request, descricao=e.nome)

    def perform_update(self, s):
        e = s.save()
        registar("equipa.equipa_alterada", modulo=MODULO, objeto=e, request=self.request, descricao=e.nome)


def responsaveis_possiveis(utilizador, modulo: str):
    """A quem o utilizador pode atribuir registos do módulo (âmbito de TRANSFERIR)."""
    amb = ambito_efetivo(utilizador, modulo, Operacao.TRANSFERIR)
    qs = Utilizador.objects.filter(is_active=True).select_related("equipa").order_by("nome")
    if amb == Ambito.TODOS:
        return qs
    if amb == Ambito.EQUIPA and utilizador.equipa_id:
        return qs.filter(Q(equipa_id=utilizador.equipa_id) | Q(pk=utilizador.pk))
    return qs.filter(pk=utilizador.pk)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def responsaveis(request):
    """Lista para o campo «Responsável» dos formulários (?modulo=imoveis)."""
    modulo = request.query_params.get("modulo", "")
    if not modulo:
        return Response({"detail": "Indique o módulo."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(
        [
            {"id": u.pk, "nome": u.nome, "equipa": u.equipa.nome if u.equipa_id else None}
            for u in responsaveis_possiveis(request.user, modulo)
        ]
    )
