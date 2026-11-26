"""Plano de Marketing de Imóveis: emissão, indicadores e recálculo (D-53)."""

from datetime import timedelta

from django.utils import timezone

from apps.core.auditoria import registar
from apps.tarefas.models import Tarefa
from apps.tarefas.servicos import valor_categoria

from .catalogo import CATALOGO, SEMANAS, offset_dias
from .models import PlanoMarketing

FECHADAS = ("concluida", "cancelada", "substituida")


ORIGENS_CICLO = {"catalogo": "Catálogo-padrão (as 45 marcadas)", "anterior": "Seleção do ciclo anterior"}
DESTINOS_PENDENTES = {
    "manter": "Manter ativas (continuam por fazer no plano anterior)",
    "encerrar": "Encerrar como «Não executada — Plano substituído»",
}
MOTIVO_SUBSTITUIDA = "Não executada — Plano substituído"


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


def criar_plano(cmi, excluidos: set[int], utilizador, request=None, renovacao=None, anterior=None,
                origem="", destino="") -> PlanoMarketing:  # fmt: skip
    """Cria o plano e as 45 ocorrências (as desmarcadas ficam com «Incluir» desligado). Chamar dentro de uma
    transação, com o CMI bloqueado (select_for_update), para não haver planos repetidos."""
    responsavel = cmi.imovel.responsavel
    plano = PlanoMarketing.objects.create(
        imovel=cmi.imovel, angariacao=cmi, ciclo=renovacao.ciclo if renovacao else 1,
        data_base=renovacao.data_inicio if renovacao else cmi.data_inicio, renovacao=renovacao,
        plano_anterior=anterior, origem_ciclo=origem, destino_pendentes=destino, responsavel=responsavel,
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
    dados = {"cmi": cmi.referencia, "ciclo": plano.ciclo, "data_base": str(plano.data_base),
             "excluidos": sorted(excluidos), "origem": origem, "destino": destino}  # fmt: skip
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


def data_base_origem(plano):
    """Data de que o plano depende: início da renovação (ciclos seguintes) ou do CMI (plano inicial)."""
    return plano.renovacao.data_inicio if plano.renovacao_id else plano.angariacao.data_inicio


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


# ----- Novo ciclo após renovação (F4-04, Cap. 19, D-54) -----


def plano_vigente(cmi):
    """O plano mais recente (maior ciclo) deste CMI, ou None."""
    return PlanoMarketing.objects.ativos().filter(angariacao=cmi).order_by("-ciclo").first()


def renovacao_sem_ciclo(cmi):
    """A renovação mais recente que ainda não deu ciclo de marketing — só se já houver um plano anterior."""
    anterior = plano_vigente(cmi)
    if anterior is None:
        return None
    r = cmi.renovacoes.order_by("-ciclo").first()
    return r if r is not None and r.ciclo > anterior.ciclo else None


def impedimento_ciclo(cmi) -> str | None:
    if not cmi.imovel_id:
        return "O CMI tem de estar ligado a um imóvel registado."
    if plano_vigente(cmi) is None:
        return "Este CMI ainda não tem plano de marketing: crie primeiro o plano inicial."
    if renovacao_sem_ciclo(cmi) is None:
        return "Não há renovação nova deste CMI sem ciclo de marketing."
    return None


def previa_ciclo(cmi, origem: str) -> dict:
    """O que o novo ciclo vai criar e o que acontece às pendentes do anterior — nada é gravado."""
    r = renovacao_sem_ciclo(cmi)
    anterior = plano_vigente(cmi)
    incluidas_antes = set(anterior.tarefas.filter(eliminado_em__isnull=True, incluida=True).values_list(
        "mk_numero", flat=True))  # fmt: skip
    pend = pendentes(anterior).filter(incluida=True).order_by("mk_numero")
    return {
        "angariacao": cmi.pk,
        "renovacao": r.pk,
        "ciclo": r.ciclo,
        "data_base": r.data_inicio,
        "origem": origem,
        "responsavel_nome": cmi.imovel.responsavel.nome,
        "anterior": {
            "id": anterior.pk,
            "referencia": anterior.referencia,
            "ciclo": anterior.ciclo,
            "pendentes": [{"tarefa": t.pk, "numero": t.mk_numero, "titulo": t.titulo, "prazo": t.prazo} for t in pend],
        },  # fmt: skip
        "ocorrencias": [
            {
                "numero": n,
                "semana": s,
                "designacao": d,
                "prazo": prazo(r.data_inicio, s),
                "incluida": origem == "catalogo" or n in incluidas_antes,
            }
            for n, s, d in CATALOGO
        ],  # fmt: skip
        "origens": [{"valor": k, "nome": v} for k, v in ORIGENS_CICLO.items()],
        "destinos": [{"valor": k, "nome": v} for k, v in DESTINOS_PENDENTES.items()],
    }


def criar_ciclo(cmi, excluidos: set[int], origem, destino, utilizador, request=None) -> PlanoMarketing:
    """Novo ciclo: novo plano com identidade e datas próprias; o anterior fica inativo, com as suas datas,
    concluídas, responsáveis e histórico. Pendentes: mantidas ou encerradas como «Não executada — Plano
    substituído». Chamar dentro de uma transação, com o CMI bloqueado."""
    r = renovacao_sem_ciclo(cmi)
    anterior = plano_vigente(cmi)
    encerradas = []
    if destino == "encerrar":
        estado = valor_categoria("estados_tarefa", "substituida")
        for t in pendentes(anterior).select_for_update(of=("self",)):
            t.estado, t.atualizado_por = estado, utilizador
            t.motivo_estado = f"{MOTIVO_SUBSTITUIDA} pelo ciclo {r.ciclo}"
            t.concluida_em = None
            t.save()
            encerradas.append(t.referencia)
    anterior.ativo, anterior.atualizado_por = False, utilizador
    anterior.save()
    plano = criar_plano(cmi, excluidos, utilizador, request=request, renovacao=r, anterior=anterior,
                        origem=origem, destino=destino)  # fmt: skip
    registar("plano_marketing.substituido", modulo="marketing-imoveis", objeto=anterior, request=request,
             dados={"novo": plano.referencia, "destino": destino, "encerradas": encerradas})  # fmt: skip
    return plano
