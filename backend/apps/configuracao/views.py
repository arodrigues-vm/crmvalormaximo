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
        "categorias": lista.categorias,
        "valores": [
            {"id": v.id, "nome": v.nome, "ordem": v.ordem, "ativo": v.ativo, "categoria": v.categoria} for v in valores
        ],
    }


@extend_schema(summary="Listas de valores (com valores desativados apenas para administradores)")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listas(request):
    admin = pode(request.user, MODULO, Operacao.ADMINISTRAR)
    return Response([_lista_json(lista, admin) for lista in Lista.objects.prefetch_related("valores")])


class ValorSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=100, trim_whitespace=True)
    categoria = serializers.CharField(max_length=30, required=False, allow_blank=True)


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
    categoria = s.validated_data.get("categoria", "")
    validas = [c["valor"] for c in lista.categorias]
    if validas and categoria not in validas:
        raise serializers.ValidationError({"categoria": "Escolha a categoria deste valor."})
    if not validas:
        categoria = ""
    ultimo = lista.valores.order_by("-ordem").values_list("ordem", flat=True).first() or 0
    v = ValorLista.objects.create(lista=lista, nome=nome, ordem=ultimo + 1, categoria=categoria)
    registar("lista.valor_criado", modulo=MODULO, objeto=v, request=request, dados={"lista": chave, "nome": nome})
    return Response(_lista_json(lista, True), status=status.HTTP_201_CREATED)


class AlterarValorSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=100, required=False)
    ativo = serializers.BooleanField(required=False)
    categoria = serializers.CharField(max_length=30, required=False)


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
    antes = {"nome": v.nome, "ativo": v.ativo, "categoria": v.categoria}
    dados = dict(s.validated_data)
    categoria = dados.pop("categoria", None)
    if categoria is not None:
        validas = [c["valor"] for c in v.lista.categorias]
        # A categoria só se escolhe uma vez: depois de definida não muda (regras dependem dela).
        if v.categoria or categoria not in validas:
            raise serializers.ValidationError({"categoria": "A categoria deste valor não pode ser alterada."})
        v.categoria = categoria
    for k, valor in dados.items():
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
        dados={
            "lista": v.lista.chave,
            "antes": antes,
            "depois": {"nome": v.nome, "ativo": v.ativo, "categoria": v.categoria},
        },
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


VALIDADORES_PARAMETROS = {
    # chave: função que valida e normaliza o valor (levanta ValidationError)
    "cmi_alertas_dias": lambda v: _lista_dias(v),
    "mfa_obrigatoria": lambda v: _sim_nao(v),
}


def _sim_nao(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, str) and v.lower() in ("true", "false", "sim", "não", "nao"):
        return v.lower() in ("true", "sim")
    raise serializers.ValidationError("Escolha Sim ou Não.")


def _lista_dias(v):
    if not isinstance(v, list) or not v or len(v) > 5:
        raise serializers.ValidationError("Indique entre 1 e 5 limiares.")
    try:
        dias = sorted({int(x) for x in v}, reverse=True)
    except (TypeError, ValueError) as e:
        raise serializers.ValidationError("Os limiares têm de ser números inteiros de dias.") from e
    if any(d < 1 or d > 3650 for d in dias):
        raise serializers.ValidationError("Cada limiar tem de estar entre 1 e 3650 dias.")
    return dias


@extend_schema(summary="Parâmetros de funcionamento")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def parametros(request):
    from .listas_sistema import semear_parametros
    from .models import Parametro

    semear_parametros()
    return Response(list(Parametro.objects.values("chave", "nome", "descricao", "modulo", "valor")))


class ParametroSerializer(serializers.Serializer):
    valor = serializers.JSONField()


@extend_schema(request=ParametroSerializer)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def alterar_parametro(request, chave):
    from .models import Parametro

    _exigir_administrar(request)
    p = Parametro.objects.filter(chave=chave).first()
    if p is None or chave not in VALIDADORES_PARAMETROS:
        return Response(status=status.HTTP_404_NOT_FOUND)
    s = ParametroSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    try:
        novo = VALIDADORES_PARAMETROS[chave](s.validated_data["valor"])
    except serializers.ValidationError as e:
        raise serializers.ValidationError({"valor": e.detail}) from e
    antes, p.valor = p.valor, novo
    p.save()
    registar("parametro.alterado", modulo=MODULO, objeto=p, request=request, dados={"antes": antes, "depois": novo})
    return Response({"chave": p.chave, "nome": p.nome, "descricao": p.descricao, "modulo": p.modulo, "valor": p.valor})


# Disposição dos ecrãs (D-43) ----------------------------------------------------------------------


def _validar_blocos(blocos):
    if not isinstance(blocos, list) or not blocos or len(blocos) > 40:
        raise serializers.ValidationError("Indique entre 1 e 40 separadores.")
    chaves, campos = set(), set()
    limpos = []
    for b in blocos:
        if not isinstance(b, dict):
            raise serializers.ValidationError("Separador inválido.")
        chave = str(b.get("chave", "")).strip()
        titulo = str(b.get("titulo", "")).strip()
        lista = b.get("campos", [])
        if not chave or len(chave) > 60 or chave in chaves:
            raise serializers.ValidationError("Cada separador precisa de uma chave única.")
        if not titulo or len(titulo) > 80:
            raise serializers.ValidationError("Cada separador precisa de um nome (até 80 caracteres).")
        if not isinstance(lista, list) or any(not isinstance(c, str) or not c or len(c) > 60 for c in lista):
            raise serializers.ValidationError(f"Campos inválidos no separador «{titulo}».")
        repetidos = campos.intersection(lista)
        if repetidos or len(set(lista)) != len(lista):
            raise serializers.ValidationError("Cada campo só pode estar num separador.")
        chaves.add(chave)
        campos.update(lista)
        limpos.append({"chave": chave, "titulo": titulo, "campos": lista})
    return limpos


@extend_schema(summary="Disposição dos ecrãs de um módulo")
@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def disposicao(request, modulo):
    """GET: disposição guardada (ou `blocos: null` = de origem). PUT: guardar (Administrador). DELETE: voltar à
    disposição de origem (Administrador). Tudo auditado."""
    from .models import Disposicao

    d = Disposicao.objects.filter(modulo=modulo).first()
    if request.method == "GET":
        return Response({"modulo": modulo, "blocos": d.blocos if d else None})
    _exigir_administrar(request)
    if request.method == "DELETE":
        if d:
            registar("disposicao.reposta", modulo=MODULO, objeto=d, request=request, dados={"antes": d.blocos})
            d.delete()
        return Response({"modulo": modulo, "blocos": None})
    try:
        blocos = _validar_blocos(request.data.get("blocos"))
    except serializers.ValidationError as e:
        raise serializers.ValidationError({"blocos": e.detail}) from e
    antes = d.blocos if d else None
    d, _ = Disposicao.objects.update_or_create(
        modulo=modulo, defaults={"blocos": blocos, "atualizado_por": request.user}
    )
    registar("disposicao.alterada", modulo=MODULO, objeto=d, request=request, dados={"antes": antes, "depois": blocos})
    return Response({"modulo": modulo, "blocos": d.blocos})
