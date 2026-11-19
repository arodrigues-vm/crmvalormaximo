from datetime import date, timedelta
from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.configuracao.models import parametro

from .models import Angariacao


def hoje() -> date:
    return timezone.localdate()  # Europe/Lisbon


def conflitos(angariacao: Angariacao, inicio: date, fim: date, *, regime=None, operacao=None):
    """CMI em curso do mesmo imóvel e da mesma categoria de operação cujo período se sobrepõe,
    quando algum dos dois é exclusivo. Contratos não exclusivos podem coexistir."""
    regime = regime if regime is not None else angariacao.regime
    operacao = operacao if operacao is not None else angariacao.operacao
    outros = (
        Angariacao.objects.ativos()
        .filter(
            imovel_id=angariacao.imovel_id,
            situacao=Angariacao.Situacao.EM_CURSO,
            data_inicio__isnull=False,
            data_fim_vigente__isnull=False,
            data_inicio__lte=fim,
            data_fim_vigente__gte=inicio,
        )
        .select_related("regime", "operacao")
    )
    if angariacao.pk:
        outros = outros.exclude(pk=angariacao.pk)
    if operacao is not None:
        outros = outros.filter(Q(operacao__categoria=operacao.categoria) | Q(operacao__isnull=True))
    este_exclusivo = regime is not None and regime.categoria == "exclusivo"
    return [o for o in outros if este_exclusivo or (o.regime and o.regime.categoria == "exclusivo")]


def descrever_conflitos(lista) -> str:
    return "; ".join(
        f"{o.referencia} ({o.data_inicio:%d/%m/%Y}–{o.data_fim_vigente:%d/%m/%Y}, {o.regime or 'regime não indicado'})"
        for o in lista
    )


def alerta(angariacao: Angariacao, dia: date | None = None) -> dict | None:
    """Aviso de expiração segundo os limiares configurados (por omissão 120/60/30 dias)."""
    dia = dia or hoje()
    if angariacao.estado(dia) not in ("ativa", "renovada"):
        return None
    dias = (angariacao.data_fim_vigente - dia).days
    limiares = sorted(int(x) for x in parametro("cmi_alertas_dias"))
    nivel = next((lim for lim in limiares if dias <= lim), None)
    return {"dias": dias, "limiar": nivel} if nivel is not None else None


CORES_ALERTA = ["vermelho", "laranja", "amarelo"]  # do limiar mais curto para o mais longo


def tempo_restante(angariacao: Angariacao, dia: date | None = None) -> dict | None:
    """Dias até à data fim de contrato e cor (D-34): ≤30 vermelho, ≤60 laranja, ≤120 amarelo, resto verde.
    Os limiares são os do parâmetro «cmi_alertas_dias»."""
    dia = dia or hoje()
    if angariacao.estado(dia) not in ("ativa", "renovada", "por_iniciar") or not angariacao.data_fim_vigente:
        return None
    dias = (angariacao.data_fim_vigente - dia).days
    limiares = sorted(int(x) for x in parametro("cmi_alertas_dias"))
    cor = "verde"
    for i, lim in enumerate(limiares):
        if dias <= lim:
            cor = CORES_ALERTA[i] if i < len(CORES_ALERTA) else "amarelo"
            break
    return {"dias": dias, "cor": cor}


def comissao_estimada(angariacao: Angariacao) -> Decimal | None:
    """Valor da comissão previsto (D-34): preço do imóvel × % (ou o valor fixo), nunca abaixo do mínimo.
    Só para venda com percentagem ou valor fixo; nos restantes casos não se estima."""
    a = angariacao
    M = Angariacao.Modalidade
    if a.valor_remuneracao is None:
        return None
    if a.modalidade_remuneracao == M.VALOR_FIXO:
        valor = a.valor_remuneracao
    elif a.modalidade_remuneracao == M.PERCENTAGEM and a.imovel.preco is not None:
        base = a.valor_vendido if a.valor_vendido is not None else a.imovel.preco
        valor = base * a.valor_remuneracao / Decimal(100)
    else:
        return None
    if a.valor_minimo_remuneracao is not None:
        valor = max(valor, a.valor_minimo_remuneracao)
    return valor.quantize(Decimal("0.01"))


def filtro_estado(qs, estado: str, dia: date | None = None):
    dia = dia or hoje()
    em_curso = Q(situacao=Angariacao.Situacao.EM_CURSO)
    assinado = Q(data_inicio__isnull=False, prazo_meses__isnull=False)
    if estado == "por_assinar":
        return qs.filter(em_curso).exclude(assinado)
    if estado == "vigentes":
        return qs.filter(em_curso & assinado, data_inicio__lte=dia, data_fim_vigente__gte=dia)
    if estado == "a_expirar":
        maior = max(int(x) for x in parametro("cmi_alertas_dias"))
        return qs.filter(
            em_curso & assinado, data_fim_vigente__gte=dia, data_fim_vigente__lte=dia + timedelta(days=maior)
        )
    if estado == "expiradas":
        return qs.filter(em_curso & assinado, data_fim_vigente__lt=dia)
    if estado == "concluidas":
        return qs.filter(situacao=Angariacao.Situacao.CONCLUIDA)
    if estado == "canceladas":
        return qs.filter(situacao=Angariacao.Situacao.CANCELADA)
    return qs


def papel_proprietario():
    from apps.configuracao.models import ValorLista

    return ValorLista.objects.filter(lista__chave="papeis_interveniente_cmi", nome="Proprietário").first()


def sincronizar_partes(cmi: Angariacao) -> None:
    """D-35: as partes proprietárias de um CMI em curso são SEMPRE os proprietários atuais do imóvel
    (com as quotas). Representantes legais, procuradores e outros papéis mantêm-se. Contratos
    concluídos ou cancelados ficam como estavam: uma nova comercialização é um imóvel novo
    («Duplicar imóvel»)."""
    from .models import Interveniente

    if cmi.situacao != Angariacao.Situacao.EM_CURSO:
        return
    papel = papel_proprietario()
    donos = list(cmi.imovel.proprietarios.order_by("ordem", "id"))
    ids_donos = {p.entidade_id for p in donos}
    # Saem os antigos proprietários (papel «Proprietário» ou sem papel) que já não o são.
    cmi.intervenientes.exclude(entidade_id__in=ids_donos).filter(
        models.Q(papel__isnull=True) | models.Q(papel=papel)
    ).delete()
    for ordem, p in enumerate(donos):
        Interveniente.objects.update_or_create(
            angariacao=cmi,
            entidade_id=p.entidade_id,
            defaults={"papel": papel, "quota": p.quota, "ordem": ordem},
        )
    for ordem, i in enumerate(cmi.intervenientes.exclude(entidade_id__in=ids_donos), start=len(donos)):
        if i.ordem != ordem:
            i.ordem = ordem
            i.save(update_fields=["ordem"])


def sincronizar_partes_do_imovel(imovel) -> None:
    for cmi in imovel.angariacoes.filter(situacao=Angariacao.Situacao.EM_CURSO, eliminado_em__isnull=True):
        sincronizar_partes(cmi)
