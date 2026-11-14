"""Serviço central de autorização. Toda a decisão de acesso passa por aqui.

Uso típico numa vista:
    qs = filtrar(request.user, "imoveis", Operacao.CONSULTAR, Imovel.objects.all())
"""

from django.db.models import Q, QuerySet
from rest_framework.permissions import BasePermission

from .models import ORDEM_AMBITO, Ambito, Operacao, PermissaoPerfil, PermissaoUtilizador


def ambito_efetivo(utilizador, modulo: str, operacao: str) -> str:
    if not utilizador or not utilizador.is_authenticated or not utilizador.is_active:
        return Ambito.NENHUM
    if utilizador.is_superuser:
        return Ambito.TODOS
    propria = (
        PermissaoUtilizador.objects.filter(utilizador=utilizador, modulo=modulo, operacao=operacao)
        .values_list("ambito", flat=True)
        .first()
    )
    if propria is not None:
        return propria
    return (
        PermissaoPerfil.objects.filter(perfil=utilizador.perfil, modulo=modulo, operacao=operacao)
        .values_list("ambito", flat=True)
        .first()
        or Ambito.NENHUM
    )


def pode(utilizador, modulo: str, operacao: str) -> bool:
    """O utilizador tem a operação sobre pelo menos alguns registos do módulo?"""
    return ambito_efetivo(utilizador, modulo, operacao) != Ambito.NENHUM


def matriz_utilizador(utilizador) -> dict[str, dict[str, str]]:
    """Permissões efetivas de um utilizador (para a interface adaptar menus/botões)."""
    from .modulos import MODULOS

    resultado = {m: {o: Ambito.NENHUM for o in Operacao.values} for m in MODULOS}
    if not utilizador.is_authenticated or not utilizador.is_active:
        return resultado
    if utilizador.is_superuser:
        return {m: {o: Ambito.TODOS for o in Operacao.values} for m in MODULOS}
    for m, o, a in PermissaoPerfil.objects.filter(perfil=utilizador.perfil).values_list(
        "modulo", "operacao", "ambito"
    ):
        if m in resultado:
            resultado[m][o] = a
    for m, o, a in PermissaoUtilizador.objects.filter(utilizador=utilizador).values_list(
        "modulo", "operacao", "ambito"
    ):
        if m in resultado:
            resultado[m][o] = a
    return resultado


def filtrar(
    utilizador,
    modulo: str,
    operacao: str,
    queryset: QuerySet,
    campo_responsavel: str = "responsavel",
    campo_partilhas: str | None = None,
) -> QuerySet:
    """Restringe um queryset aos registos a que o utilizador tem acesso.

    - TODOS: sem restrição;
    - EQUIPA: registos cujo responsável pertence à equipa do utilizador
      (sem equipa, degrada para ATRIBUIDOS);
    - ATRIBUIDOS: registos de que é responsável ou que lhe foram partilhados;
    - NENHUM: nenhum registo.
    """
    ambito = ambito_efetivo(utilizador, modulo, operacao)
    if ambito == Ambito.TODOS:
        return queryset
    if ambito == Ambito.NENHUM:
        return queryset.none()

    condicao = Q(**{campo_responsavel: utilizador})
    if campo_partilhas:
        condicao |= Q(**{campo_partilhas: utilizador})
    if ambito == Ambito.EQUIPA and utilizador.equipa_id:
        condicao |= Q(**{f"{campo_responsavel}__equipa_id": utilizador.equipa_id})
    return queryset.filter(condicao).distinct() if campo_partilhas else queryset.filter(condicao)


def ambito_inclui(ambito: str, minimo: str) -> bool:
    return ORDEM_AMBITO[ambito] >= ORDEM_AMBITO[minimo]


OPERACAO_POR_ACAO = {
    "list": Operacao.CONSULTAR,
    "retrieve": Operacao.CONSULTAR,
    "create": Operacao.CRIAR,
    "update": Operacao.EDITAR,
    "partial_update": Operacao.EDITAR,
    "destroy": Operacao.ELIMINAR,
}


class PermissaoModulo(BasePermission):
    """Permissão DRF: a vista declara `modulo`; a ação define a operação.

    O acesso a cada registo concreto é garantido pelo `get_queryset` da vista,
    que deve usar `filtrar(...)` — um registo fora do âmbito devolve 404.
    """

    def has_permission(self, request, view):
        modulo = getattr(view, "modulo", None)
        if modulo is None:
            return False
        acao = getattr(view, "action", None)
        operacao = getattr(view, "operacoes_extra", {}).get(acao) or OPERACAO_POR_ACAO.get(acao)
        if operacao is None:
            return False
        return pode(request.user, modulo, operacao)
