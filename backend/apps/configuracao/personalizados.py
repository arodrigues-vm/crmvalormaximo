"""Campos personalizados (D-44): validação dos valores, apresentação e relações entre módulos.

Os valores ficam em `RegistoBase.campos_personalizados` (JSON), por isso acrescentar, mudar o nome ou desativar
um campo nunca altera a base de dados. Tudo é validado aqui, no servidor; o ecrã nunca é fonte de verdade.
"""

import datetime
from decimal import Decimal, InvalidOperation

from django.apps import apps
from django.core.exceptions import ValidationError as ErroDjango
from django.core.validators import EmailValidator, URLValidator
from django.db.models import Q
from rest_framework import serializers

from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar
from apps.core.validacao import normalizar_telefone

# ecrã → (modelo, módulo de permissões, nome, campos de pesquisa)
ECRAS = {
    "entidades": ("entidades.Entidade", "entidades", "Entidades", ["referencia", "nome", "apelido", "nif", "email"]),
    "imoveis": ("imoveis.Imovel", "imoveis", "Imóveis", ["referencia", "localidade", "rua", "artigo_matricial"]),
    "angariacoes": ("angariacoes.Angariacao", "angariacoes", "Angariações (CMI)", ["referencia", "numero_contrato"]),
    "oportunidades": (
        "oportunidades.Oportunidade",
        "oportunidades",
        "Oportunidades de Angariação",
        ["referencia", "localidade", "descricao_imovel"],
    ),
    "procuras": ("procuras.Procura", "procuras", "Procuras e Qualificação", ["referencia"]),
    "visitas": ("visitas.Visita", "visitas", "Visitas", ["referencia", "imovel_descricao_livre"]),
    "interesses": ("visitas.Interesse", "visitas", "Interesses", ["referencia"]),
    "propostas": ("propostas.Proposta", "propostas", "Propostas", ["referencia", "imovel_descricao_livre"]),
    "agentes": ("agentes.Agente", "agentes", "Agentes", ["referencia", "nome"]),
    "agencias": ("agentes.Agencia", "agencias", "Agências", ["referencia", "nome"]),
}

TIPOS_LISTA = {"lista", "lista_multipla"}
TIPOS_RELACAO = {"relacao", "relacao_multipla"}
MAX_CAMPOS_POR_ECRA = 100


def modelo_do_ecra(ecra):
    return apps.get_model(ECRAS[ecra][0])


def _modelo_tem_campo(modelo, nome):
    try:
        modelo._meta.get_field(nome)
        return True
    except Exception:  # noqa: BLE001 — campo inexistente
        return False


def titulo_registo(obj) -> str:
    texto = str(obj)
    ref = getattr(obj, "referencia", None)
    return texto if not ref or texto == ref else f"{ref} · {texto}"


def registos_visiveis(utilizador, ecra, ids):
    """Ids, dos indicados, que o utilizador pode consultar (e que não estão na lixeira)."""
    modelo = modelo_do_ecra(ecra)
    qs = modelo.objects.filter(pk__in=ids, eliminado_em__isnull=True)
    qs = filtrar(utilizador, ECRAS[ecra][1], Operacao.CONSULTAR, qs, campo_partilhas=_partilhas(modelo))
    return set(qs.values_list("pk", flat=True))


def _partilhas(modelo):
    return "partilhada_com" if _modelo_tem_campo(modelo, "partilhada_com") else None


def procurar(utilizador, ecra, termo, limite=20):
    modelo = modelo_do_ecra(ecra)
    qs = modelo.objects.filter(eliminado_em__isnull=True)
    qs = filtrar(utilizador, ECRAS[ecra][1], Operacao.CONSULTAR, qs, campo_partilhas=_partilhas(modelo))
    for palavra in termo.split()[:5]:
        cond = Q()
        for campo in ECRAS[ecra][3]:
            if _modelo_tem_campo(modelo, campo):
                cond |= Q(**{f"{campo}__icontains": palavra})
        qs = qs.filter(cond)
    return [{"id": o.pk, "titulo": titulo_registo(o)} for o in qs.order_by("-pk")[:limite]]


def definicoes(ecra, so_ativos=False):
    from .models import CampoPersonalizado

    qs = CampoPersonalizado.objects.filter(ecra=ecra).select_related("lista")
    return list(qs.filter(ativo=True) if so_ativos else qs)


def _vazio(v):
    return v is None or v == "" or v == []


def _ids(v, campo):
    lista = v if isinstance(v, list) else [v]
    try:
        ids = [int(x) for x in lista]
    except (TypeError, ValueError) as e:
        raise serializers.ValidationError({campo: ["Valor inválido."]}) from e
    if len(ids) != len(set(ids)) or len(ids) > 200:
        raise serializers.ValidationError({campo: ["Valores repetidos ou em excesso."]})
    return ids


def _validar_um(c, v, atual, utilizador):
    """Valida e normaliza o valor de um campo. Devolve o valor a guardar."""
    erro = lambda m: serializers.ValidationError({c.chave: [m]})  # noqa: E731
    t = c.tipo
    if t in ("texto", "texto_longo"):
        if not isinstance(v, str):
            raise erro("Texto inválido.")
        v = v.strip()
        limite = 255 if t == "texto" else 10000
        if len(v) > limite:
            raise erro(f"Máximo de {limite} caracteres.")
        return v
    if t == "inteiro":
        try:
            n = int(str(v).strip())
        except ValueError as e:
            raise erro("Indique um número inteiro.") from e
        if abs(n) > 2_000_000_000:
            raise erro("Número demasiado grande.")
        return n
    if t in ("decimal", "moeda"):
        try:
            d = Decimal(str(v).strip().replace(" ", "").replace(",", "."))
        except InvalidOperation as e:
            raise erro("Indique um número.") from e
        if not d.is_finite() or abs(d) >= Decimal("1e13"):
            raise erro("Número inválido.")
        if t == "moeda":
            d = d.quantize(Decimal("0.01"))
        return str(d)
    if t == "data":
        try:
            return datetime.date.fromisoformat(str(v)).isoformat()
        except ValueError as e:
            raise erro("Data inválida.") from e
    if t == "email":
        v = str(v).strip()
        try:
            EmailValidator()(v)
        except ErroDjango as e:
            raise erro("Email inválido.") from e
        return v
    if t == "url":
        v = str(v).strip()
        try:
            URLValidator(schemes=["http", "https"])(v)
        except ErroDjango as e:
            raise erro("Endereço inválido (deve começar por https://).") from e
        return v
    if t == "telefone":
        texto = str(v).strip()
        try:
            return normalizar_telefone("PT", texto)
        except ErroDjango as e:
            raise erro("Telefone inválido. Para números estrangeiros comece por + e o indicativo.") from e
    if t == "sim_nao":
        if isinstance(v, bool):
            return v
        if str(v).lower() in ("sim", "true", "nao", "não", "false"):
            return str(v).lower() in ("sim", "true")
        raise erro("Escolha Sim ou Não.")
    if t in TIPOS_LISTA:
        ids = _ids(v, c.chave)
        if t == "lista" and len(ids) != 1:
            raise erro("Escolha uma opção.")
        validos = set(c.lista.valores.filter(ativo=True).values_list("pk", flat=True)) if c.lista else set()
        ja = set(atual if isinstance(atual, list) else [atual]) if atual is not None else set()
        if any(i not in validos and i not in ja for i in ids):
            raise erro("Opção inválida ou desativada.")
        return ids[0] if t == "lista" else ids
    if t in TIPOS_RELACAO:
        ids = _ids(v, c.chave)
        if t == "relacao" and len(ids) != 1:
            raise erro("Escolha um registo.")
        ja = set(atual if isinstance(atual, list) else [atual]) if atual is not None else set()
        novos = [i for i in ids if i not in ja]
        if novos and set(novos) - registos_visiveis(utilizador, c.modulo_relacao, novos):
            raise erro("Registo inexistente ou a que não tem acesso.")
        return ids[0] if t == "relacao" else ids
    raise erro("Tipo de campo desconhecido.")


def validar_valores(ecra, recebidos, atuais, utilizador, criacao):
    """Devolve o novo dicionário de valores. `recebidos` None = não enviado (mantém tudo)."""
    atuais = dict(atuais or {})
    defs = definicoes(ecra)
    if recebidos is None:
        if criacao:
            recebidos = {}
        else:
            return atuais
    if not isinstance(recebidos, dict):
        raise serializers.ValidationError({"campos_personalizados": ["Formato inválido."]})
    conhecidas = {c.chave for c in defs}
    desconhecidas = set(recebidos) - conhecidas
    if desconhecidas:
        raise serializers.ValidationError(
            {"campos_personalizados": [f"Campos desconhecidos: {', '.join(sorted(desconhecidas))}."]}
        )
    erros = {}
    novo = dict(atuais)
    for c in defs:
        if not c.ativo:
            continue  # campos desativados: os valores guardados mantêm-se, sem alterações
        if c.chave not in recebidos:
            if criacao and c.obrigatorio:
                erros[c.chave] = ["Campo obrigatório."]
            continue
        v = recebidos[c.chave]
        if _vazio(v):
            if c.obrigatorio:
                erros[c.chave] = ["Campo obrigatório."]
            novo.pop(c.chave, None)
            continue
        try:
            novo[c.chave] = _validar_um(c, v, atuais.get(c.chave), utilizador)
        except serializers.ValidationError as e:
            erros.update(e.detail)
    if erros:
        raise serializers.ValidationError(erros)
    return novo


def representar(ecra, valores, utilizador):
    """Nomes legíveis para listas e relações: {chave: [{"id", "titulo", "acessivel"}] | "nome"}."""
    valores = valores or {}
    nomes = {}
    for c in definicoes(ecra):
        v = valores.get(c.chave)
        if v is None:
            continue
        ids = v if isinstance(v, list) else [v]
        if c.tipo in TIPOS_LISTA and c.lista:
            mapa = dict(c.lista.valores.filter(pk__in=ids).values_list("pk", "nome"))
            nomes[c.chave] = [{"id": i, "titulo": mapa.get(i, "—"), "acessivel": True} for i in ids]
        elif c.tipo in TIPOS_RELACAO and c.modulo_relacao in ECRAS:
            visiveis = registos_visiveis(utilizador, c.modulo_relacao, ids)
            objs = {o.pk: o for o in modelo_do_ecra(c.modulo_relacao).objects.filter(pk__in=visiveis)}
            nomes[c.chave] = [
                {"id": i, "titulo": titulo_registo(objs[i]), "acessivel": True}
                if i in objs
                else {"id": i, "titulo": "Registo a que não tem acesso", "acessivel": False}
                for i in ids
            ]
    return nomes


def texto_legivel(c, v):
    """Valor em texto, para o histórico e a auditoria."""
    if v is None:
        return None
    ids = v if isinstance(v, list) else [v]
    if c.tipo in TIPOS_LISTA and c.lista:
        mapa = dict(c.lista.valores.filter(pk__in=ids).values_list("pk", "nome"))
        return ", ".join(mapa.get(i, "?") for i in ids)
    if c.tipo in TIPOS_RELACAO and c.modulo_relacao in ECRAS:
        refs = dict(modelo_do_ecra(c.modulo_relacao).objects.filter(pk__in=ids).values_list("pk", "referencia"))
        return ", ".join(refs.get(i) or "?" for i in ids)
    if c.tipo == "sim_nao":
        return "Sim" if v else "Não"
    return str(v)


def alteracoes(ecra, antes, depois):
    """Lista de alterações legíveis entre dois dicionários de valores."""
    antes, depois = antes or {}, depois or {}
    res = []
    for c in definicoes(ecra):
        a, d = antes.get(c.chave), depois.get(c.chave)
        if a != d:
            res.append({"campo": c.nome, "antes": texto_legivel(c, a), "depois": texto_legivel(c, d)})
    return res
