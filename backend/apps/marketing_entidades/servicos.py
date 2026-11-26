"""Marketing de Entidades: público, RGPD, inscrições e tarefas (D-55)."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.auditoria import registar
from apps.entidades.models import Entidade
from apps.tarefas.models import Tarefa
from apps.tarefas.servicos import valor_categoria

from .models import Inscricao, PlanoEntidades

MODULO = "marketing-entidades"
CRITERIOS = {
    # chave → (filtro na entidade, lista de valores ou modelo para validar)
    "papeis": ("papeis__in", "papeis_entidade"),
    "status": ("status_id__in", "status_entidade"),
    "origens": ("origem_id__in", "origens_contacto"),
    "zonas": ("zona_comercial_id__in", "zonas_comerciais"),
    "concelhos": ("freguesia__concelho_id__in", None),
}
NOMES_CRITERIOS = {
    "papeis": "Tipo de cliente",
    "status": "Status",
    "origens": "Origem do contacto",
    "zonas": "Zona",
    "concelhos": "Concelho",
}
ABERTAS = ("aberta", "em_curso")


def publico(plano):
    """Entidades que cumprem os critérios do plano (sem critérios = todas). Ainda sem a regra de RGPD."""
    qs = Entidade.objects.ativos()
    for chave, (filtro, _) in CRITERIOS.items():
        ids = (plano.criterios or {}).get(chave) or []
        if ids:
            qs = qs.filter(**{filtro: ids})
    return qs.distinct()


def filtro_rgpd(plano) -> Q:
    """Condição de contacto autorizado (Cap. 20): oposição exclui sempre; consentimento só se concedido."""
    cond = Q(oposicao_marketing=False)
    if plano.fundamento == PlanoEntidades.Fundamento.CONSENTIMENTO:
        cond &= Q(consentimento_marketing=Entidade.Consentimento.CONCEDIDO)
    return cond


def impedimento_rgpd(entidade, plano) -> str | None:
    if entidade.oposicao_marketing:
        return "A entidade opôs-se a marketing."
    if (plano.fundamento == PlanoEntidades.Fundamento.CONSENTIMENTO
            and entidade.consentimento_marketing != Entidade.Consentimento.CONCEDIDO):  # fmt: skip
        return "O plano exige consentimento e a entidade não o concedeu (não se presume)."
    return None


def cumpre(entidade, plano) -> bool:
    return publico(plano).filter(pk=entidade.pk).exists()


def resumo_publico(plano) -> dict:
    qs = publico(plano)
    total = qs.count()
    autorizadas = qs.filter(filtro_rgpd(plano))
    ativas = Inscricao.objects.ativos().filter(plano=plano, estado=Inscricao.Estado.ATIVA).values("entidade_id")
    return {
        "total": total,
        "oposicao": qs.filter(oposicao_marketing=True).count(),
        "sem_consentimento": (
            qs.filter(oposicao_marketing=False)
            .exclude(consentimento_marketing=Entidade.Consentimento.CONCEDIDO)
            .count()
            if plano.fundamento == PlanoEntidades.Fundamento.CONSENTIMENTO
            else 0
        ),  # fmt: skip
        "autorizadas": autorizadas.count(),
        "ja_inscritas": autorizadas.filter(pk__in=ativas).count(),
        "a_inscrever": autorizadas.exclude(pk__in=ativas).count(),
    }


def _responsavel(passo, entidade):
    r = passo.responsavel if passo.responsavel_id and passo.responsavel.is_active else None
    return r or entidade.responsavel


def _criar_tarefa(inscricao, passo, prazo, utilizador):
    e = inscricao.entidade
    categoria = valor_categoria("categorias_tarefa", "marketing_entidades")
    return Tarefa.objects.create(
        titulo=passo.nome, descricao=passo.descricao, categoria=categoria,
        estado=valor_categoria("estados_tarefa", "aberta"), prazo=prazo, origem_modulo="entidades", origem_id=e.pk,
        inscricao=inscricao, passo=passo, responsavel=_responsavel(passo, e), criado_por=utilizador,
        atualizado_por=utilizador,
    )  # fmt: skip


def inscrever(entidade, plano, origem, utilizador=None, request=None) -> Inscricao | None:
    """Inscreve a entidade e cria as tarefas dos passos ativos. Devolve None se já está inscrita ou se o RGPD não
    o permite (o chamador decide se isso é erro). Bloqueia a entidade para evitar inscrições repetidas."""
    with transaction.atomic():
        entidade = Entidade.objects.select_for_update().get(pk=entidade.pk)
        if impedimento_rgpd(entidade, plano) or not plano.ativo:
            return None
        if Inscricao.objects.ativos().filter(entidade=entidade, plano=plano, estado=Inscricao.Estado.ATIVA).exists():
            return None
        hoje = timezone.localdate()
        ins = Inscricao.objects.create(
            entidade=entidade, plano=plano, inicio=hoje, origem=origem, responsavel=entidade.responsavel,
            criado_por=utilizador, atualizado_por=utilizador,
        )  # fmt: skip
        for passo in plano.passos.filter(ativo=True):
            _criar_tarefa(ins, passo, hoje + timedelta(days=passo.dias), utilizador)
        registar("marketing_entidades.inscrita", modulo=MODULO, objeto=ins, request=request,
                 dados={"entidade": entidade.referencia, "plano": plano.nome, "origem": origem})  # fmt: skip
        return ins


def repetir(tarefa, utilizador, request=None):
    """Tarefa periódica concluída: cria a seguinte (data de conclusão + periodicidade), se a inscrição continuar
    ativa, o passo ativo, o RGPD o permitir e ainda não houver uma por fazer do mesmo passo."""
    passo, ins = tarefa.passo, tarefa.inscricao
    if not passo or not passo.periodicidade_dias or not passo.ativo or ins.estado != Inscricao.Estado.ATIVA:
        return None
    if impedimento_rgpd(ins.entidade, ins.plano):
        return None
    aberta = Q(estado__categoria__in=ABERTAS) | Q(estado__isnull=True)
    if ins.tarefas.filter(aberta, passo=passo, eliminado_em__isnull=True).exists():
        return None
    nova = _criar_tarefa(ins, passo, timezone.localdate() + timedelta(days=passo.periodicidade_dias), utilizador)
    registar("marketing_entidades.repeticao", modulo=MODULO, objeto=ins, request=request,
             dados={"tarefa": nova.referencia, "prazo": str(nova.prazo)})  # fmt: skip
    return nova


def terminar(ins, motivo, utilizador=None, request=None):
    """Termina a inscrição e cancela as tarefas por fazer (com motivo). As concluídas ficam no histórico."""
    cancelada = valor_categoria("estados_tarefa", "cancelada")
    aberta = Q(estado__categoria__in=ABERTAS) | Q(estado__isnull=True)
    for t in ins.tarefas.filter(aberta, eliminado_em__isnull=True).select_for_update(of=("self",)):
        t.estado, t.motivo_estado, t.atualizado_por = cancelada, f"Plano terminado: {motivo}", utilizador
        t.save()
    ins.estado, ins.terminada_em, ins.motivo_fim = Inscricao.Estado.TERMINADA, timezone.now(), motivo
    ins.atualizado_por = utilizador
    ins.save()
    registar("marketing_entidades.terminada", modulo=MODULO, objeto=ins, request=request, dados={"motivo": motivo})


def disparar(gatilho, entidade, utilizador=None):
    """Inicia os planos ativos que têm este gatilho ligado e cujo público a entidade cumpre (D-55)."""
    for plano in PlanoEntidades.objects.filter(ativo=True):
        if gatilho in (plano.gatilhos or []) and cumpre(entidade, plano):
            inscrever(entidade, plano, gatilho, utilizador)


def rever_rgpd(entidade):
    """Oposição ou retirada do consentimento: terminar as inscrições que deixaram de estar autorizadas."""
    for ins in Inscricao.objects.ativos().filter(entidade=entidade, estado=Inscricao.Estado.ATIVA).select_related(
        "plano"
    ):  # fmt: skip
        motivo = impedimento_rgpd(entidade, ins.plano)
        if motivo:
            terminar(ins, motivo)
