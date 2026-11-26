"""Acontecimentos da Agenda e avisos (D-51).

Os acontecimentos derivados lêem-se da origem em cada pedido (sem cópias): mudar a visita muda a Agenda.
Permissão: módulo Agenda **e** o módulo de origem (cada origem filtrada pelas suas próprias regras).
"""

import calendar
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.utils import timezone

from apps.configuracao.models import parametro
from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import ambito_efetivo, filtrar
from apps.entidades.models import Entidade
from apps.tarefas.models import Tarefa
from apps.visitas.models import Visita

from .models import AvisoDispensado, Compromisso

LISBOA = ZoneInfo("Europe/Lisbon")
MAX_DIAS = 100
ABERTA = ("aberta", "em_curso")
FORA_DE_AVISO = ("cancelada", "realizada", "nao_compareceu")


def _aviso(chave, origem, titulo, momento, caminho):
    return {"chave": chave, "origem": origem, "titulo": titulo, "momento": _iso(momento), "caminho": caminho}


def _pode(u, modulo) -> bool:
    return ambito_efetivo(u, modulo, Operacao.CONSULTAR) != Ambito.NENHUM


def _momento(d: date, h: time | None) -> datetime | None:
    return datetime.combine(d, h, tzinfo=LISBOA) if h else None


def _iso(m: datetime | None) -> str | None:
    return timezone.localtime(m, LISBOA).isoformat() if m else None


def _evento(chave, origem, titulo, dia, inicio=None, fim=None, estado=None, caminho="", responsavel=None, detalhe=""):
    cat = estado.categoria if estado else None
    return {
        "chave": chave,
        "origem": origem,
        "titulo": titulo,
        "data": dia.isoformat(),
        "inicio": _iso(inicio),
        "fim": _iso(fim),
        "dia_inteiro": inicio is None,
        "estado_nome": estado.nome if estado else None,
        "estado_categoria": cat,
        "caminho": caminho,
        "responsavel": responsavel.pk if responsavel else None,
        "responsavel_nome": responsavel.nome if responsavel else None,
        "detalhe": detalhe,
    }


def aniversario_em(nascimento: date, ano: int) -> date:
    """29/02 aparece a 28/02 nos anos comuns (Cap. 17)."""
    if nascimento.month == 2 and nascimento.day == 29 and not calendar.isleap(ano):
        return date(ano, 2, 28)
    return nascimento.replace(year=ano)


def _imovel(o) -> str:
    from apps.propostas.serializers import descricao_imovel

    return descricao_imovel(o)


def eventos(u, inicio: date, fim: date, pessoa=None, cancelados=False) -> list[dict]:
    """Acontecimentos entre `inicio` e `fim` (inclusive), ordenados. `pessoa`: id do utilizador ou None (todos
    os que o utilizador pode ver)."""
    saida = []
    a, b = datetime.combine(inicio, time.min, tzinfo=LISBOA), datetime.combine(fim + timedelta(days=1), time.min,
                                                                               tzinfo=LISBOA)  # fmt: skip
    if _pode(u, "agenda"):
        qs = filtrar(u, "agenda", Operacao.CONSULTAR, Compromisso.objects.ativos(), campo_partilhas="partilhada_com")
        qs = qs.filter(inicio__gte=a, inicio__lt=b).select_related("estado", "tipo", "responsavel", "entidade")
        if pessoa:
            qs = qs.filter(Q(responsavel_id=pessoa) | Q(partilhada_com=pessoa)).distinct()
        if not cancelados:
            qs = qs.exclude(estado__categoria="cancelado")
        for c in qs:
            detalhe = " · ".join(filter(None, [c.tipo.nome if c.tipo else "", c.local]))
            saida.append(
                _evento(
                    f"compromisso-{c.pk}",
                    "compromisso",
                    c.titulo,
                    timezone.localtime(c.inicio, LISBOA).date(),
                    c.inicio,
                    c.fim,
                    c.estado,
                    f"/agenda/compromissos/{c.pk}",
                    c.responsavel,
                    detalhe,
                )  # fmt: skip
            )
    if _pode(u, "visitas"):
        qs = filtrar(u, "visitas", Operacao.CONSULTAR, Visita.objects.ativos(), campo_partilhas="partilhada_com")
        qs = qs.filter(data__gte=inicio, data__lte=fim).select_related(
            "estado", "responsavel", "entidade", "imovel__tipo", "imovel__tipologia"
        )
        if pessoa:
            qs = qs.filter(Q(responsavel_id=pessoa) | Q(consultor_comprador_id=pessoa) | Q(consultor_imovel_id=pessoa))
        if not cancelados:
            qs = qs.exclude(estado__categoria="cancelada")
        for v in qs:
            cliente = v.entidade.nome_completo if v.entidade_id else ""
            saida.append(
                _evento(
                    f"visita-{v.pk}",
                    "visita",
                    f"Visita · {cliente}".strip(" ·"),
                    v.data,
                    _momento(v.data, v.hora_entrada),
                    _momento(v.data, v.hora_saida),
                    v.estado,
                    f"/visitas/{v.pk}",
                    v.responsavel,
                    _imovel(v),
                )  # fmt: skip
            )
    if _pode(u, "pos-venda"):
        qs = filtrar(u, "pos-venda", Operacao.CONSULTAR, Tarefa.objects.ativos(), campo_partilhas="partilhada_com")
        qs = qs.filter(prazo__gte=inicio, prazo__lte=fim).select_related("estado", "responsavel", "transacao__entidade")
        if pessoa:
            qs = qs.filter(responsavel_id=pessoa)
        if not cancelados:
            qs = qs.exclude(estado__categoria="cancelada")
        for t in qs:
            cliente = t.transacao.entidade.nome_completo if t.transacao_id else ""
            saida.append(
                _evento(
                    f"tarefa-{t.pk}",
                    "tarefa",
                    t.titulo,
                    t.prazo,
                    estado=t.estado,
                    caminho=f"/pos-venda/{t.pk}",
                    responsavel=t.responsavel,
                    detalhe=cliente,
                )  # fmt: skip
            )
    if _pode(u, "entidades"):
        dias = [inicio + timedelta(days=i) for i in range((fim - inicio).days + 1)]
        meses = {d.month for d in dias}
        qs = filtrar(u, "entidades", Operacao.CONSULTAR, Entidade.objects.ativos(), campo_partilhas="partilhada_com")
        qs = qs.filter(data_nascimento__isnull=False, data_nascimento__month__in=meses).select_related("responsavel")
        if pessoa:
            qs = qs.filter(responsavel_id=pessoa)
        no_intervalo = set(dias)
        for e in qs:
            for ano in sorted({d.year for d in dias}):
                dia = aniversario_em(e.data_nascimento, ano)
                if dia in no_intervalo and ano > e.data_nascimento.year:
                    saida.append(
                        _evento(
                            f"aniversario-{e.pk}-{ano}",
                            "aniversario",
                            f"Aniversário de {e.nome_completo} ({ano - e.data_nascimento.year} anos)",
                            dia,
                            caminho=f"/entidades/{e.pk}",
                            responsavel=e.responsavel,
                        )  # fmt: skip
                    )
    ordem = {"aniversario": 0, "tarefa": 1}
    saida.sort(key=lambda x: (x["data"], not x["dia_inteiro"], x["inicio"] or "", ordem.get(x["origem"], 2)))
    return saida


def avisos(u, agora: datetime | None = None) -> list[dict]:
    """Avisos internos do próprio utilizador (Cap. 17): compromisso N horas antes; visita N minutos antes (se
    tiver hora); tarefa no dia do prazo. Calculados em cada pedido; os dispensados não voltam."""
    agora = agora or timezone.now()
    hoje = timezone.localtime(agora, LISBOA).date()
    saida = []
    if _pode(u, "agenda"):
        limite = agora + timedelta(hours=int(parametro("agenda_aviso_compromisso_horas")))
        for c in Compromisso.objects.ativos().filter(
            Q(responsavel=u) | Q(partilhada_com=u), inicio__gte=agora, inicio__lte=limite,
            estado__categoria="agendado",
        ).distinct():  # fmt: skip
            saida.append(_aviso(f"compromisso-{c.pk}-{c.inicio:%Y%m%d%H%M}", "compromisso", c.titulo, c.inicio,
                                f"/agenda/compromissos/{c.pk}"))  # fmt: skip
    if _pode(u, "visitas"):
        minutos = int(parametro("agenda_aviso_visita_minutos"))
        qs = Visita.objects.ativos().filter(
            Q(responsavel=u) | Q(consultor_comprador=u) | Q(consultor_imovel=u),
            data__gte=hoje, data__lte=hoje + timedelta(days=1), hora_entrada__isnull=False,
        ).exclude(estado__categoria__in=FORA_DE_AVISO).select_related("entidade")  # fmt: skip
        for v in qs:
            m = _momento(v.data, v.hora_entrada)
            if agora <= m <= agora + timedelta(minutes=minutos):
                cliente = v.entidade.nome_completo if v.entidade_id else ""
                saida.append(_aviso(f"visita-{v.pk}-{m:%Y%m%d%H%M}", "visita", f"Visita · {cliente}".strip(" ·"), m,
                                    f"/visitas/{v.pk}"))  # fmt: skip
    if _pode(u, "pos-venda"):
        for t in Tarefa.objects.ativos().filter(
            Q(responsavel=u) | Q(partilhada_com=u), prazo=hoje
        ).filter(Q(estado__categoria__in=ABERTA) | Q(estado__isnull=True)).distinct():  # fmt: skip
            saida.append(_aviso(f"tarefa-{t.pk}-{t.prazo:%Y%m%d}", "tarefa", t.titulo, None, f"/pos-venda/{t.pk}"))
    dispensados = set(
        AvisoDispensado.objects.filter(utilizador=u, chave__in=[x["chave"] for x in saida]).values_list(
            "chave", flat=True
        )
    )
    saida = [x for x in saida if x["chave"] not in dispensados]
    saida.sort(key=lambda x: x["momento"] or "")
    return saida


def pessoas_visiveis(u) -> list[dict]:
    """Pessoas cuja agenda o utilizador pode escolher no filtro (pelo âmbito de consulta da Agenda)."""
    from apps.contas.models import Utilizador

    ambito = ambito_efetivo(u, "agenda", Operacao.CONSULTAR)
    qs = Utilizador.objects.filter(is_active=True)
    if ambito == Ambito.TODOS:
        pass
    elif ambito == Ambito.EQUIPA and u.equipa_id:
        qs = qs.filter(Q(equipa_id=u.equipa_id) | Q(pk=u.pk))
    else:
        qs = qs.filter(pk=u.pk)
    return [{"id": x.pk, "nome": x.nome} for x in qs.order_by("nome")]
