"""Plano de Marketing de Imóveis: emissão, indicadores e recálculo (D-53)."""

from datetime import timedelta

from django.utils import timezone

from apps.core.auditoria import registar
from apps.tarefas.models import Tarefa
from apps.tarefas.servicos import valor_categoria

from .catalogo import CATALOGO, SEMANAS, offset_dias
from .models import PlanoMarketing

FECHADAS = ("concluida", "cancelada")


def impedimento(cmi) -> str | None:
    """Motivo pelo qual ainda não se pode criar o plano inicial deste CMI (None = pode)."""
    if not cmi.imovel_id:
        return "O CMI tem de estar ligado a um imóvel registado."
    if not cmi.assinado:
        return "O CMI ainda não está assinado (falta a data de início ou o prazo)."
    if PlanoMarketing.objects.ativos().filter(angariacao=cmi, ciclo=1).exists():
        return "Este CMI já tem o plano inicial."
    return None


def prazo(data_base, semana):
    return data_base + timedelta(days=offset_dias(semana))


def previa(cmi) -> dict:
    """O que «Criar plano inicial» vai criar — nada é gravado."""
    responsavel = cmi.imovel.responsavel
    return {
        "angariacao": cmi.pk,
        "imovel": cmi.imovel_id,
        "data_base": cmi.data_inicio,
        "responsavel": responsavel.pk,
        "responsavel_nome": responsavel.nome,
        "ocorrencias": [
            {"numero": n, "semana": s, "designacao": d, "prazo": prazo(cmi.data_inicio, s), "incluida": True}
            for n, s, d in CATALOGO
        ],
    }


def criar_plano(cmi, excluidos: set[int], utilizador, request=None) -> PlanoMarketing:
    """Cria o plano e as 45 ocorrências (as desmarcadas ficam com «Incluir» desligado). Chamar dentro de uma
    transação, com o CMI bloqueado (select_for_update), para não haver planos repetidos."""
    responsavel = cmi.imovel.responsavel
    plano = PlanoMarketing.objects.create(
        imovel=cmi.imovel, angariacao=cmi, ciclo=1, data_base=cmi.data_inicio, responsavel=responsavel,
        criado_por=utilizador, atualizado_por=utilizador,
    )  # fmt: skip
    categoria = valor_categoria("categorias_tarefa", "marketing")
    estado = valor_categoria("estados_tarefa", "aberta")
    for n, s, d in CATALOGO:
        Tarefa.objects.create(
            titulo=d, categoria=categoria, estado=estado, prazo=prazo(plano.data_base, s), plano=plano,
            mk_numero=n, mk_semana=s, incluida=n not in excluidos, responsavel=responsavel,
            criado_por=utilizador, atualizado_por=utilizador,
        )  # fmt: skip
    dados = {"cmi": cmi.referencia, "data_base": str(plano.data_base), "excluidos": sorted(excluidos)}
    registar("plano_marketing.criado", modulo="marketing-imoveis", objeto=plano, request=request, dados=dados)
    return plano


def cor(incluidas: int, concluidas: int) -> str:
    """Zero incluídas = neutro; nenhuma concluída = vermelho; parcial = amarelo; todas = verde (Cap. 18)."""
    if incluidas == 0:
        return "neutro"
    if concluidas == 0:
        return "vermelho"
    return "verde" if concluidas >= incluidas else "amarelo"


def indicadores(tarefas) -> dict:
    """Contadores por semana e totais, só com as ocorrências incluídas."""
    semanas = []
    for s in range(1, SEMANAS + 1):
        da_semana = [t for t in tarefas if t.mk_semana == s and t.incluida]
        conc = sum(1 for t in da_semana if t.estado and t.estado.categoria == "concluida")
        n = len(da_semana)
        semanas.append({"semana": s, "incluidas": n, "concluidas": conc, "cor": cor(n, conc)})
    inc = sum(x["incluidas"] for x in semanas)
    conc = sum(x["concluidas"] for x in semanas)
    return {"semanas": semanas, "incluidas": inc, "concluidas": conc, "cor": cor(inc, conc), "total": len(tarefas)}


def pendentes(plano):
    return plano.tarefas.filter(eliminado_em__isnull=True).exclude(estado__categoria__in=FECHADAS)


def previa_recalculo(plano, nova_base) -> list[dict]:
    return [
        {"tarefa": t.pk, "numero": t.mk_numero, "titulo": t.titulo, "prazo_atual": t.prazo,
         "prazo_novo": prazo(nova_base, t.mk_semana)}
        for t in pendentes(plano).order_by("mk_numero")
    ]  # fmt: skip


def aplicar_recalculo(plano, nova_base, utilizador):
    """Novos prazos para as pendentes; concluídas e canceladas ficam como estão."""
    for t in pendentes(plano).select_for_update(of=("self",)):
        t.prazo = prazo(nova_base, t.mk_semana)
        t.atualizado_por = utilizador
        t.save()
    plano.data_base = nova_base
    plano.atualizado_por = utilizador
    plano.atualizado_em = timezone.now()
    plano.save()
