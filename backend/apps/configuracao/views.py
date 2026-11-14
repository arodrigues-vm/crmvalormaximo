from django.db import IntegrityError, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.contas.models import Operacao
from apps.contas.permissoes import pode
from apps.core.auditoria import registar

from .models import Lista, ValorLista

MODULO = "configuracoes"


def _exigir_administrar(request):
    if not pode(request.user, MODULO, Operacao.ADMINISTRAR):
        raise PermissionDenied("Só o Administrador pode alterar as listas de valores.")


def _lista_json(lista, incluir_inativos):
    valores = lista.valores.all() if incluir_inativos else lista.valores.filter(ativo=True)
    return {
        "chave": lista.chave,
        "nome": lista.nome,
        "modulo": lista.modulo,
        "descricao": lista.descricao,
        "valores": [{"id": v.id, "nome": v.nome, "ordem": v.ordem, "ativo": v.ativo} for v in valores],
    }


@extend_schema(summary="Listas de valores (com valores desativados apenas para administradores)")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listas(request):
    admin = pode(request.user, MODULO, Operacao.ADMINISTRAR)
    return Response([_lista_json(lista, admin) for lista in Lista.objects.prefetch_related("valores")])


class ValorSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=100, trim_whitespace=True)


@extend_schema(request=ValorSerializer)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def adicionar_valor(request, chave):
    _exigir_administrar(request)
    lista = Lista.objects.filter(chave=chave).first()
    if lista is None:
        return Response(status=status.HTTP_404_NOT_FOUND)
    s = ValorSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    nome = s.validated_data["nome"]
    if lista.valores.filter(nome__iexact=nome).exists():
        raise serializers.ValidationError({"nome": "Já existe um valor com este nome (pode estar desativado)."})
    ultimo = lista.valores.order_by("-ordem").values_list("ordem", flat=True).first() or 0
    v = ValorLista.objects.create(lista=lista, nome=nome, ordem=ultimo + 1)
    registar("lista.valor_criado", modulo=MODULO, objeto=v, request=request, dados={"lista": chave, "nome": nome})
    return Response(_lista_json(lista, True), status=status.HTTP_201_CREATED)


class AlterarValorSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=100, required=False)
    ativo = serializers.BooleanField(required=False)


@extend_schema(request=AlterarValorSerializer)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def alterar_valor(request, pk):
    """Renomear ou ativar/desativar. Não há eliminação: preserva os registos que usam o valor."""
    _exigir_administrar(request)
    v = ValorLista.objects.select_related("lista").filter(pk=pk).first()
    if v is None:
        return Response(status=status.HTTP_404_NOT_FOUND)
    s = AlterarValorSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    antes = {"nome": v.nome, "ativo": v.ativo}
    for k, valor in s.validated_data.items():
        setattr(v, k, valor.strip() if isinstance(valor, str) else valor)
    if not v.nome:
        raise serializers.ValidationError({"nome": "O nome é obrigatório."})
    try:
        with transaction.atomic():
            v.save()
    except IntegrityError as e:
        raise serializers.ValidationError({"nome": "Já existe um valor com este nome."}) from e
    registar(
        "lista.valor_alterado",
        modulo=MODULO,
        objeto=v,
        request=request,
        dados={"lista": v.lista.chave, "antes": antes, "depois": {"nome": v.nome, "ativo": v.ativo}},
    )
    return Response(_lista_json(v.lista, True))


class OrdemSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField())


@extend_schema(request=OrdemSerializer)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ordenar(request, chave):
    _exigir_administrar(request)
    lista = Lista.objects.filter(chave=chave).first()
    if lista is None:
        return Response(status=status.HTTP_404_NOT_FOUND)
    s = OrdemSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    ids = s.validated_data["ids"]
    existentes = set(lista.valores.values_list("id", flat=True))
    if set(ids) != existentes or len(ids) != len(existentes):
        raise serializers.ValidationError({"ids": "Indique todos os valores da lista, uma vez cada."})
    with transaction.atomic():
        for ordem, i in enumerate(ids):
            ValorLista.objects.filter(pk=i).update(ordem=ordem)
    registar("lista.reordenada", modulo=MODULO, request=request, dados={"lista": chave})
    return Response(_lista_json(lista, True))
