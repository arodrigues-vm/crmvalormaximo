"""Cálculo da comissão a partir do CMI e do negócio (F3-07, D-48). Tudo em Decimal, no servidor."""

from decimal import Decimal

from apps.angariacoes.models import Angariacao
from apps.configuracao.models import parametro

from .models import CEM, Beneficiario, Comissao, arred

M = Angariacao.Modalidade


def fotografia(transacao) -> dict:
    """Base de cálculo tirada do CMI escolhido na transação e do valor do negócio."""
    c = transacao.angariacao
    base = {
        "cmi_referencia": c.referencia if c else "",
        "cmi_versao": c.versao if c else None,
        "modalidade": c.modalidade_remuneracao if c else "",
        "taxa_ou_valor": c.valor_remuneracao if c else None,
        "base_negocio": transacao.valor,
        "minimo": c.valor_minimo_remuneracao if c else None,
        "taxa_iva": c.taxa_iva if c else None,
        "inclui_iva": c.remuneracao_inclui_iva if c else None,
    }
    base["valor_calculado"] = calcular(base)
    return base


def calcular(b: dict) -> Decimal | None:
    """Comissão total SEM IVA, ou None quando não se pode calcular (fica «por apurar»).

    - % sobre o valor do negócio; valor fixo; n.º de rendas × renda mensal (valor da transação);
    - nunca abaixo da remuneração mínima;
    - se o CMI indica valores com IVA incluído, retira-se o IVA (é preciso conhecer a taxa).
    - «% sobre base contratual» não se calcula: a base é descrita em texto no CMI."""
    t, base, modalidade = b["taxa_ou_valor"], b["base_negocio"], b["modalidade"]
    if t is None or not modalidade:
        return None
    if modalidade == M.PERCENTAGEM and base is not None:
        valor = base * t / CEM
    elif modalidade == M.VALOR_FIXO:
        valor = t
    elif modalidade == M.NUMERO_RENDAS and base is not None:
        valor = base * t
    else:
        return None
    if b["minimo"] is not None:
        valor = max(valor, b["minimo"])
    if b["inclui_iva"]:
        if b["taxa_iva"] is None:
            return None
        valor = valor / (1 + b["taxa_iva"] / CEM)
    return arred(Decimal(valor))


def lados_nossos(transacao) -> tuple[bool, bool]:
    """O lado da angariação é nosso quando o responsável pelo imóvel é da nossa Equipa; o da venda, quando o
    responsável pela entidade (comprador) é da nossa Equipa (D-46)."""
    return transacao.consultor_imovel_id is not None, transacao.consultor_comprador_id is not None


def beneficiarios_propostos(transacao, ang: bool, venda: bool) -> list[dict]:
    """Propõe o responsável de cada lado nosso, com a forma de cálculo habitual da sua ficha."""
    linhas = []
    for lado, nosso, u in (
        (Beneficiario.Lado.ANGARIACAO, ang, transacao.consultor_imovel),
        (Beneficiario.Lado.VENDA, venda, transacao.consultor_comprador),
    ):
        if not nosso or u is None:
            continue
        pct = u.comissao_pct_angariacao if lado == Beneficiario.Lado.ANGARIACAO else u.comissao_pct_venda
        linhas.append(
            {
                "lado": lado,
                "utilizador": u,
                "modo": u.comissao_modo,
                "percentagem": pct if u.comissao_modo == "percentagem" else None,
                "deducao": u.comissao_deducao if u.comissao_modo == "deducao" else None,
            }
        )
    return linhas


def pct_angariacao_omissao() -> Decimal:
    return Decimal(str(parametro("comissao_reparticao_angariacao")))


def resumo(c: Comissao) -> dict:
    """Totais por lado: valor do lado, pago aos consultores e o que fica para a agência."""
    res = {}
    for lado in Beneficiario.Lado.values:
        valor = c.valor_do_lado(lado)
        linhas = [b for b in c.beneficiarios.all() if b.lado == lado]
        conhecidos = [b.valor for b in linhas]
        consultores = None if any(v is None for v in conhecidos) or valor is None else sum(conhecidos, Decimal(0))
        res[lado] = {
            "nosso": c.lado_nosso(lado),
            "valor": None if valor is None else str(valor),
            "consultores": None if consultores is None else str(consultores),
            "agencia": None if consultores is None else str(valor - consultores),
        }
    nossos = [res[x] for x in res if res[x]["nosso"]]
    if nossos and all(r["valor"] is not None for r in nossos):
        res["total_nosso"] = str(sum((Decimal(r["valor"]) for r in nossos), Decimal(0)))
    else:
        res["total_nosso"] = None
    agencia = [r["agencia"] for r in nossos]
    res["total_agencia"] = (
        str(sum((Decimal(a) for a in agencia), Decimal(0))) if nossos and all(a is not None for a in agencia) else None
    )
    return res
