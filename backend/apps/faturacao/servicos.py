"""Prestações, saldos e regras dos pagamentos aos consultores (F3-08, D-49). Tudo em Decimal, no servidor."""

from collections import OrderedDict
from decimal import Decimal

from apps.comissoes.models import arred

from .models import ZERO, DocumentoConsultor, Movimento, Prestacao

# Percentagem paga no CPCV por categoria do momento de pagamento do CMI (o resto na escritura).
NO_CPCV = {"cpcv_100": Decimal(100), "cpcv_50": Decimal(50), "escritura_100": ZERO}


def proposta_prestacoes(comissao) -> list[dict]:
    """Propõe, para cada consultor, as prestações segundo o momento de pagamento do CMI (não grava nada)."""
    t = comissao.transacao
    cmi = t.angariacao
    momento = cmi.momento_pagamento if cmi else None
    pct_cpcv = NO_CPCV.get(momento.categoria if momento else "", None)
    if t.arrendamento:
        pct_cpcv = ZERO  # no arrendamento não há CPCV: tudo no contrato
    por_consultor: dict = OrderedDict()
    for b in comissao.beneficiarios.select_related("utilizador"):
        if b.valor is not None:
            por_consultor[b.utilizador] = por_consultor.get(b.utilizador, ZERO) + b.valor
    linhas = []
    for u, valor in por_consultor.items():
        if pct_cpcv is None:  # momento não indicado no CMI: uma só prestação, a definir
            linhas.append(
                {
                    "utilizador": u.pk,
                    "utilizador_nome": u.nome,
                    "momento": Prestacao.Momento.ESCRITURA,
                    "percentagem": "100",
                    "valor": str(valor),
                    "data_prevista": t.data_escritura_prevista,
                }
            )
            continue
        cpcv = arred(valor * pct_cpcv / Decimal(100))
        partes = [
            (Prestacao.Momento.CPCV, pct_cpcv, cpcv, t.data_cpcv or t.data_cpcv_prevista),
            (
                Prestacao.Momento.ESCRITURA,
                Decimal(100) - pct_cpcv,
                valor - cpcv,
                t.data_escritura or t.data_escritura_prevista,
            ),
        ]
        for m, pct, v, data in partes:
            if pct > 0:
                linhas.append(
                    {
                        "utilizador": u.pk,
                        "utilizador_nome": u.nome,
                        "momento": m,
                        "percentagem": str(pct),
                        "valor": str(v),
                        "data_prevista": data,
                    }
                )
    return linhas


def pago(documento) -> Decimal:
    """Pagamentos efetivos menos estornos efetivos."""
    total = ZERO
    for m in documento.movimentos.all():
        if m.estado != Movimento.Estado.EFETIVO:
            continue
        total += m.valor if m.tipo == Movimento.Tipo.PAGAMENTO else -m.valor
    return total


def estornos_pendentes(documento) -> Decimal:
    return sum(
        (
            m.valor
            for m in documento.movimentos.all()
            if m.tipo == Movimento.Tipo.ESTORNO and m.estado == Movimento.Estado.PENDENTE
        ),
        ZERO,
    )


def saldo_documento(d: DocumentoConsultor) -> dict:
    p = pago(d)
    a_pagar = d.a_pagar
    return {
        "a_pagar": f"{a_pagar:.2f}",
        "pago": f"{p:.2f}",
        "em_aberto": f"{a_pagar - p:.2f}" if not d.credito else "0.00",
        "estornos_pendentes": f"{estornos_pendentes(d):.2f}",
    }


def estornavel(pagamento: Movimento) -> Decimal:
    """Quanto ainda se pode estornar de um pagamento (descontando estornos efetivos e pendentes)."""
    usados = sum(
        (
            e.valor
            for e in pagamento.estornos.all()
            if e.estado in (Movimento.Estado.EFETIVO, Movimento.Estado.PENDENTE)
        ),
        ZERO,
    )
    return pagamento.valor - usados


def resumo_consultores(comissao) -> list[dict]:
    """Por consultor: a receber (comissão), faturado (documentos), pago e o que falta."""
    linhas: dict = OrderedDict()

    def linha(u):
        return linhas.setdefault(
            u.pk,
            {
                "utilizador": u.pk,
                "utilizador_nome": u.nome,
                "a_receber": ZERO,
                "a_receber_conhecido": True,
                "faturado": ZERO,
                "pago": ZERO,
            },
        )

    for b in comissao.beneficiarios.select_related("utilizador"):
        r = linha(b.utilizador)
        if b.valor is None:
            r["a_receber_conhecido"] = False
        else:
            r["a_receber"] += b.valor
    for d in comissao.documentos.filter(eliminado_em__isnull=True).select_related("consultor", "tipo"):
        r = linha(d.consultor)
        r["faturado"] += d.total - d.retencao if not d.credito else -(d.total - d.retencao)
        r["pago"] += pago(d)
    resultado = []
    for r in linhas.values():
        conhecido = r.pop("a_receber_conhecido")
        resultado.append(
            {
                **r,
                "a_receber": f"{r['a_receber']:.2f}" if conhecido else None,
                "faturado": f"{r['faturado']:.2f}",
                "pago": f"{r['pago']:.2f}",
                "por_pagar": f"{r['faturado'] - r['pago']:.2f}",
            }
        )
    return resultado
