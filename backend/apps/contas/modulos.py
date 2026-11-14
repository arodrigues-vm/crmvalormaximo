"""Catálogo de módulos e matriz de permissões por omissão.

A matriz por omissão é uma PROPOSTA técnica baseada em D-06/Q06 e no princípio
do privilégio mínimo. Pode ser alterada pelo Administrador (PermissaoPerfil)
sem alterar código. Novos módulos acrescentados aqui são semeados
automaticamente após cada `migrate`, sem sobrepor alterações já feitas.
"""

from .models import Ambito, Operacao, Perfil

# chave -> nome apresentado (a mesma chave é usada no frontend)
MODULOS: dict[str, str] = {
    "dashboard": "Dashboard",
    "entidades": "Entidades",
    "imoveis": "Imóveis",
    "angariacoes": "Angariações",
    "oportunidades": "Oportunidades de Angariação",
    "procuras": "Procuras e Qualificação",
    "visitas": "Visitas",
    "propostas": "Propostas",
    "transacoes": "Transações",
    "pos-venda": "Pós-Venda",
    "tarefas": "Tarefas",
    "agenda": "Agenda",
    "marketing-imoveis": "Plano de Marketing de Imóveis",
    "marketing-entidades": "Marketing de Entidades",
    "agentes": "Agentes",
    "agencias": "Agências",
    "equipa": "Equipa",
    "documentos": "Documentos",
    "faturacao": "Faturação e Comissões",
    "estatisticas": "Estatísticas",
    "comunicacao": "Comunicação",
    "glossario": "Glossário",
    "configuracoes": "Configurações",
    "auditoria": "Auditoria",
}

COMERCIAIS = {
    "entidades", "imoveis", "angariacoes", "oportunidades", "procuras", "visitas",
    "propostas", "transacoes", "pos-venda", "tarefas", "agenda", "marketing-imoveis",
    "marketing-entidades", "documentos", "comunicacao",
}  # fmt: skip
REFERENCIA = {"agentes", "agencias", "equipa", "glossario"}
PAINEIS = {"dashboard", "estatisticas"}

Op = Operacao
A = Ambito


def _ambito_omissao(perfil: str, modulo: str, operacao: str) -> str:
    if perfil == Perfil.ADMINISTRADOR:
        return A.TODOS

    if modulo in ("configuracoes", "auditoria"):
        return A.NENHUM

    if modulo in REFERENCIA:
        if operacao == Op.CONSULTAR:
            return A.TODOS
        if perfil == Perfil.RESPONSAVEL and modulo in ("agentes", "agencias", "glossario"):
            return A.TODOS if operacao in (Op.CRIAR, Op.EDITAR) else A.NENHUM
        return A.NENHUM

    if modulo in PAINEIS:
        if operacao in (Op.CONSULTAR, Op.EXPORTAR):
            return A.EQUIPA if perfil == Perfil.RESPONSAVEL else A.ATRIBUIDOS
        return A.NENHUM

    if modulo == "faturacao":
        if perfil == Perfil.RESPONSAVEL:
            return A.EQUIPA if operacao in (Op.CONSULTAR, Op.APROVAR, Op.EXPORTAR) else A.NENHUM
        if perfil == Perfil.CONSULTOR and operacao == Op.CONSULTAR:
            return A.ATRIBUIDOS
        return A.NENHUM

    # Módulos comerciais e operacionais.
    if operacao == Op.ADMINISTRAR:
        return A.NENHUM
    if perfil == Perfil.RESPONSAVEL:
        return A.EQUIPA
    if perfil == Perfil.CONSULTOR:
        # Q06: só Administrador e Responsável autorizam partilhas/transferências.
        if operacao in (Op.PARTILHAR, Op.TRANSFERIR, Op.APROVAR, Op.RESTAURAR):
            return A.NENHUM
        return A.ATRIBUIDOS
    if perfil == Perfil.ASSISTENTE:
        if operacao in (Op.CONSULTAR, Op.CRIAR, Op.EDITAR):
            return A.ATRIBUIDOS
        return A.NENHUM
    return A.NENHUM


def matriz_omissao():
    for perfil in Perfil.values:
        for modulo in MODULOS:
            for operacao in Operacao.values:
                yield perfil, modulo, operacao, _ambito_omissao(perfil, modulo, operacao)


def semear_permissoes(**kwargs):
    """Cria as linhas em falta da matriz. Nunca altera linhas existentes."""
    from .models import PermissaoPerfil

    existentes = set(PermissaoPerfil.objects.values_list("perfil", "modulo", "operacao"))
    novas = [
        PermissaoPerfil(perfil=p, modulo=m, operacao=o, ambito=a)
        for p, m, o, a in matriz_omissao()
        if (p, m, o) not in existentes
    ]
    PermissaoPerfil.objects.bulk_create(novas)
    return len(novas)
