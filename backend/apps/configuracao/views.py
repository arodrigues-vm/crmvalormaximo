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
        raise PermissionDenied("Só o Administrador pode alterar as configurações.")


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
    "comissao_reparticao_angariacao": lambda v: _percentagem(v),
    "agenda_aviso_compromisso_horas": lambda v: _inteiro(v, 1, 24 * 14),
    "agenda_aviso_visita_minutos": lambda v: _inteiro(v, 5, 24 * 60),
}


def _inteiro(v, minimo, maximo):
    try:
        n = int(str(v).strip())
    except ValueError as e:
        raise serializers.ValidationError(f"Indique um número inteiro entre {minimo} e {maximo}.") from e
    if not minimo <= n <= maximo:
        raise serializers.ValidationError(f"Indique um número inteiro entre {minimo} e {maximo}.")
    return n


def _percentagem(v):
    try:
        n = float(str(v).replace(",", "."))
    except ValueError as e:
        raise serializers.ValidationError("Indique uma percentagem entre 0 e 100.") from e
    if not 0 <= n <= 100:
        raise serializers.ValidationError("Indique uma percentagem entre 0 e 100.")
    return int(n) if n == int(n) else round(n, 2)


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


def _validar_rotulos(rotulos):
    """Nomes alterados: {chave: nome}. As chaves nunca mudam; só o texto apresentado."""
    if rotulos is None:
        return {}
    if not isinstance(rotulos, dict) or len(rotulos) > 400:
        raise serializers.ValidationError("Nomes inválidos.")
    limpos = {}
    for chave, nome in rotulos.items():
        if not isinstance(chave, str) or not chave or len(chave) > 60:
            raise serializers.ValidationError("Nomes inválidos.")
        nome = str(nome or "").strip()
        if len(nome) > 80:
            raise serializers.ValidationError("Cada nome pode ter até 80 caracteres.")
        if nome:
            limpos[chave] = nome
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
        return Response({"modulo": modulo, "blocos": d.blocos if d else None, "rotulos": d.rotulos if d else {}})
    _exigir_administrar(request)
    if request.method == "DELETE":
        if d:
            registar("disposicao.reposta", modulo=MODULO, objeto=d, request=request, dados={"antes": d.blocos})
            d.delete()
        return Response({"modulo": modulo, "blocos": None, "rotulos": {}})
    try:
        blocos = _validar_blocos(request.data.get("blocos"))
    except serializers.ValidationError as e:
        raise serializers.ValidationError({"blocos": e.detail}) from e
    try:
        rotulos = _validar_rotulos(request.data.get("rotulos", {}))
    except serializers.ValidationError as e:
        raise serializers.ValidationError({"rotulos": e.detail}) from e
    antes = {"blocos": d.blocos, "rotulos": d.rotulos} if d else None
    d, _ = Disposicao.objects.update_or_create(
        modulo=modulo, defaults={"blocos": blocos, "rotulos": rotulos, "atualizado_por": request.user}
    )
    registar(
        "disposicao.alterada",
        modulo=MODULO,
        objeto=d,
        request=request,
        dados={"antes": antes, "depois": {"blocos": blocos, "rotulos": rotulos}},
    )
    return Response({"modulo": modulo, "blocos": d.blocos, "rotulos": d.rotulos})


# Campos personalizados (D-44) -----------------------------------------------------------------------


class CampoPersonalizadoSerializer(serializers.Serializer):
    ecra = serializers.ChoiceField(choices=[])
    nome = serializers.CharField(max_length=80)
    tipo = serializers.ChoiceField(choices=[])
    obrigatorio = serializers.BooleanField(default=False)
    ajuda = serializers.CharField(max_length=200, allow_blank=True, default="")
    modulo_relacao = serializers.CharField(max_length=40, allow_blank=True, default="")

    def __init__(self, *args, **kwargs):
        from .models import CampoPersonalizado
        from .personalizados import ECRAS

        super().__init__(*args, **kwargs)
        self.fields["ecra"].choices = list(ECRAS)
        self.fields["tipo"].choices = CampoPersonalizado.TIPOS

    def validate_nome(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Indique o nome do campo.")
        return v

    def validate(self, d):
        from .personalizados import ECRAS, TIPOS_RELACAO

        if d["tipo"] in TIPOS_RELACAO:
            if d.get("modulo_relacao") not in ECRAS:
                raise serializers.ValidationError({"modulo_relacao": "Escolha o módulo a que o campo liga."})
        else:
            d["modulo_relacao"] = ""
        return d


class CampoPersonalizadoEdicaoSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=80, required=False)
    obrigatorio = serializers.BooleanField(required=False)
    ajuda = serializers.CharField(max_length=200, allow_blank=True, required=False)
    ativo = serializers.BooleanField(required=False)

    def validate_nome(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Indique o nome do campo.")
        return v


def _em_uso(c):
    from .personalizados import modelo_do_ecra

    return modelo_do_ecra(c.ecra).objects.filter(campos_personalizados__has_key=c.chave).count()


def _campo_json(c, admin):
    dados = {
        "id": c.id,
        "ecra": c.ecra,
        "chave": c.chave,
        "nome": c.nome,
        "tipo": c.tipo,
        "tipo_nome": c.get_tipo_display(),
        "obrigatorio": c.obrigatorio,
        "ajuda": c.ajuda,
        "ativo": c.ativo,
        "lista": c.lista.chave if c.lista else None,
        "opcoes": [{"id": v.id, "nome": v.nome, "ativo": v.ativo} for v in c.lista.valores.all()] if c.lista else [],
        "modulo_relacao": c.modulo_relacao,
    }
    if admin:
        dados["em_uso"] = _em_uso(c)
    return dados


def _chave_nova(ecra, nome):
    import re
    import unicodedata

    from .models import CampoPersonalizado

    base = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()
    base = "cp_" + (re.sub(r"[^a-z0-9]+", "_", base).strip("_")[:40] or "campo")
    chave, n = base, 2
    while CampoPersonalizado.objects.filter(ecra=ecra, chave=chave).exists():
        chave, n = f"{base}_{n}", n + 1
    return chave


@extend_schema(summary="Campos personalizados de um ecrã", request=CampoPersonalizadoSerializer)
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def campos_personalizados(request):
    from .models import CampoPersonalizado, Lista
    from .personalizados import ECRAS, MAX_CAMPOS_POR_ECRA, TIPOS_LISTA

    admin = pode(request.user, MODULO, Operacao.ADMINISTRAR)
    if request.method == "GET":
        ecra = request.query_params.get("ecra", "")
        qs = CampoPersonalizado.objects.filter(ecra=ecra).select_related("lista").prefetch_related("lista__valores")
        return Response(
            {
                "campos": [_campo_json(c, admin) for c in qs],
                "tipos": [{"valor": v, "nome": n} for v, n in CampoPersonalizado.TIPOS],
                "modulos": [{"valor": k, "nome": v[2]} for k, v in ECRAS.items()],
            }
        )
    _exigir_administrar(request)
    s = CampoPersonalizadoSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if CampoPersonalizado.objects.filter(ecra=d["ecra"]).count() >= MAX_CAMPOS_POR_ECRA:
        raise serializers.ValidationError({"nome": f"Máximo de {MAX_CAMPOS_POR_ECRA} campos por módulo."})
    with transaction.atomic():
        chave = _chave_nova(d["ecra"], d["nome"])
        lista = None
        if d["tipo"] in TIPOS_LISTA:
            # As opções vêm sempre de uma lista configurável (D-34), editável em Listas de valores.
            lista = Lista.objects.create(
                chave=f"{d['ecra']}-{chave}"[:60],
                nome=d["nome"],
                modulo=d["ecra"],
                descricao="Opções de um campo acrescentado pelo Administrador.",
            )
        c = CampoPersonalizado.objects.create(
            ecra=d["ecra"],
            chave=chave,
            nome=d["nome"],
            tipo=d["tipo"],
            obrigatorio=d["obrigatorio"],
            ajuda=d["ajuda"],
            modulo_relacao=d["modulo_relacao"],
            lista=lista,
            criado_por=request.user,
        )
        registar("campo_personalizado.criado", modulo=MODULO, objeto=c, request=request, dados=_campo_json(c, False))
    return Response(_campo_json(c, True), status=status.HTTP_201_CREATED)


@extend_schema(summary="Alterar ou remover um campo personalizado", request=CampoPersonalizadoEdicaoSerializer)
@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def campo_personalizado(request, pk):
    from .models import CampoPersonalizado

    _exigir_administrar(request)
    c = CampoPersonalizado.objects.filter(pk=pk).select_related("lista").first()
    if c is None:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        em_uso = _em_uso(c)
        if em_uso:
            return Response(
                {
                    "detail": f"Este campo tem valores em {em_uso} registo(s). Para não perder dados, desative-o "
                    "em vez de o remover.",
                    "codigo": "campo_em_uso",
                    "em_uso": em_uso,
                },
                status=status.HTTP_409_CONFLICT,
            )
        with transaction.atomic():
            registar(
                "campo_personalizado.removido", modulo=MODULO, objeto=c, request=request, dados=_campo_json(c, False)
            )
            lista = c.lista
            c.delete()
            if lista:
                lista.valores.all().delete()
                lista.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    s = CampoPersonalizadoEdicaoSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    antes = _campo_json(c, False)
    for k, v in s.validated_data.items():
        setattr(c, k, v)
    c.save()
    if c.lista and c.lista.nome != c.nome:
        c.lista.nome = c.nome
        c.lista.save(update_fields=["nome"])
    registar(
        "campo_personalizado.alterado",
        modulo=MODULO,
        objeto=c,
        request=request,
        dados={"antes": antes, "depois": _campo_json(c, False)},
    )
    return Response(_campo_json(c, True))


@extend_schema(summary="Procurar registos para um campo de ligação")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procurar_registos(request):
    from .personalizados import ECRAS, procurar

    ecra = request.query_params.get("ecra", "")
    if ecra not in ECRAS:
        return Response([])
    return Response(procurar(request.user, ecra, request.query_params.get("q", "")[:100]))
