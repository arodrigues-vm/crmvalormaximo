from django.utils import timezone

from apps.configuracao.models import ValorLista
from apps.core.auditoria import registar

from .models import Interesse, Visita

ESTADOS_COM_INTERESSE = ("agendada", "confirmada", "realizada")


def valor_por_categoria(chave: str, categoria: str):
    return (
        ValorLista.objects.filter(lista__chave=chave, categoria=categoria, ativo=True).order_by("ordem", "id").first()
    )


def valor_por_nome(chave: str, nome: str):
    return ValorLista.objects.filter(lista__chave=chave, nome=nome, ativo=True).first()


def cliente_da_agencia(visita: Visita) -> bool:
    """O comprador é acompanhado por nós quando o seu agente é um utilizador da aplicação ou pertence a uma
    agência de categoria «Própria». Clientes de agentes externos/da rede (muitas vezes registados como
    «Cliente externo») não geram interesses automáticos (D-37)."""
    a = visita.agente_comprador
    if a is None:
        return False
    return bool(a.utilizador_id) or bool(a.agencia_id and a.agencia.tipo and a.agencia.tipo.categoria == "propria")


def atualizar_interesse(visita: Visita, utilizador, request=None) -> Interesse | None:
    """Cria (se não existir) o interesse do cliente no imóvel e atualiza a data da última visita
    realizada. Visitas canceladas ou faltas não criam interesse."""
    if visita.imovel_id is None or not cliente_da_agencia(visita):
        return None
    categoria = visita.estado.categoria if visita.estado else "agendada"
    interesse = Interesse.objects.ativos().filter(entidade=visita.entidade, imovel=visita.imovel).first()
    if interesse is None:
        if categoria not in ESTADOS_COM_INTERESSE:
            return None
        interesse = Interesse.objects.create(
            entidade=visita.entidade,
            imovel=visita.imovel,
            origem=valor_por_nome("origens_interesse", "Visita"),
            estado=valor_por_categoria("estados_interesse", "ativo"),
            responsavel=visita.responsavel,
            criado_por=utilizador,
            atualizado_por=utilizador,
        )
        registar(
            "interesse.criado", modulo="visitas", objeto=interesse, request=request,
            descricao=f"Criado a partir da visita {visita.referencia}",
        )  # fmt: skip
    ultima = (
        Visita.objects.ativos()
        .filter(entidade=visita.entidade, imovel=visita.imovel, estado__categoria="realizada")
        .order_by("-data")
        .values_list("data", flat=True)
        .first()
    )
    if ultima != interesse.ultima_visita:
        Interesse.objects.filter(pk=interesse.pk).update(ultima_visita=ultima, atualizado_em=timezone.now())
    return interesse
