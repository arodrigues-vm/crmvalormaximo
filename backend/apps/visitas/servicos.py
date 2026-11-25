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


def cliente_externo(entidade) -> bool:
    """D-46: entidade com um «Tipo de cliente» da categoria «Cliente externo» (cliente de outra agência)."""
    return entidade is not None and entidade.papeis.filter(categoria="cliente_externo").exists()


def derivar_responsaveis(d: dict, instancia=None) -> dict:
    """D-46 (visitas e propostas): o responsável pelo imóvel vem da ficha do imóvel (Equipa se a angariação é
    própria; senão, o agente) e, se o imóvel não está registado, escolhe-se em Agentes. O responsável pela
    entidade vem da ficha da entidade, exceto «Cliente externo», em que se escolhe em Agentes.

    Numa edição só se recalcula quando o imóvel ou a entidade mudam (os já gravados ficam como estavam)."""
    from rest_framework import serializers

    val = lambda c: d.get(c, getattr(instancia, c, None))  # noqa: E731
    imovel, entidade = val("imovel"), val("entidade")
    mudou = lambda c: instancia is None or (c in d and d[c] != getattr(instancia, c))  # noqa: E731
    erros = {}
    if imovel is not None:
        if mudou("imovel") or not (val("consultor_imovel") or val("agente_imovel")):
            if imovel.angariacao_propria:
                d["consultor_imovel"], d["agente_imovel"] = imovel.responsavel, None
            elif imovel.agente_responsavel_id:
                d["consultor_imovel"], d["agente_imovel"] = None, imovel.agente_responsavel
            else:
                erros["imovel"] = "Este imóvel não tem responsável. Indique-o na ficha do imóvel."
        else:
            d.pop("agente_imovel", None)  # vem da ficha do imóvel; não se escolhe à mão
    else:
        d["consultor_imovel"] = None
        if not val("agente_imovel"):
            erros["agente_imovel"] = "Indique o responsável pelo imóvel (registado em Agentes)."
    if entidade is not None:
        if cliente_externo(entidade):
            d["consultor_comprador"] = None
            if not val("agente_comprador"):
                erros["agente_comprador"] = "Cliente externo: indique o responsável (registado em Agentes)."
        elif mudou("entidade") or not (val("consultor_comprador") or val("agente_comprador")):
            d["consultor_comprador"], d["agente_comprador"] = entidade.responsavel, None
        else:
            d.pop("agente_comprador", None)
    if erros:
        raise serializers.ValidationError(erros)
    return d


def nome_responsavel(consultor, agente) -> str | None:
    from apps.agentes.models import nome_agente

    return consultor.nome if consultor else nome_agente(agente)


def cliente_da_agencia(visita: Visita) -> bool:
    """O comprador é acompanhado por nós quando o seu agente é um utilizador da aplicação ou pertence a uma
    agência de categoria «Própria». Clientes de agentes externos/da rede (muitas vezes registados como
    «Cliente externo») não geram interesses automáticos (D-37)."""
    if visita.consultor_comprador_id:
        return True  # cliente acompanhado por um membro da nossa Equipa (D-46)
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
