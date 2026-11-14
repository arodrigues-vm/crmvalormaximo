"""Regras de negócio das Entidades (deteção de duplicados)."""

from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Q

from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar

from .models import Entidade, TelefoneEntidade

LIMIAR_NOME = 0.55


def procurar_duplicados(utilizador, *, nif="", email="", telefones=(), nome="", excluir_id=None):
    """Procura possíveis duplicados entre as entidades ativas (não eliminadas).

    Devolve (candidatos_visiveis, numero_outros). Para registos que o utilizador
    não pode consultar só é revelada a contagem (sem dados pessoais).
    Motivos fortes: NIF, email ou telefone iguais. Motivo fraco: nome semelhante.
    """
    nif = "".join((nif or "").split()).upper()
    email = (email or "").strip().lower()
    telefones = [t for t in telefones if t]
    base = Entidade.objects.ativos()
    if excluir_id:
        base = base.exclude(pk=excluir_id)

    motivos: dict[int, set[str]] = {}

    def juntar(ids, motivo):
        for i in ids:
            motivos.setdefault(i, set()).add(motivo)

    if nif:
        juntar(base.filter(nif=nif).values_list("id", flat=True), "nif")
    if email:
        juntar(base.filter(email=email).values_list("id", flat=True), "email")
    if telefones:
        ids = TelefoneEntidade.objects.filter(numero_e164__in=telefones, entidade__in=base).values_list(
            "entidade_id", flat=True
        )
        juntar(ids, "telefone")
    if nome and len(nome.strip()) >= 4:
        ids = (
            base.annotate(sim=TrigramSimilarity("nome_completo", nome.strip()))
            .filter(sim__gte=LIMIAR_NOME)
            .order_by("-sim")
            .values_list("id", flat=True)[:10]
        )
        juntar(ids, "nome")

    if not motivos:
        return [], 0
    visiveis = filtrar(
        utilizador,
        "entidades",
        Operacao.CONSULTAR,
        Entidade.objects.filter(pk__in=motivos),
        campo_partilhas="partilhada_com",
    ).select_related("responsavel")
    candidatos = [
        {
            "id": e.id,
            "referencia": e.referencia,
            "nome_completo": e.nome_completo,
            "nif": e.nif,
            "email": e.email,
            "responsavel_nome": e.responsavel.nome,
            "motivos": sorted(motivos[e.id]),
        }
        for e in visiveis
    ]
    outros = len(motivos) - len(candidatos)
    return candidatos, outros


def tem_duplicado_forte(candidatos, outros_fortes: bool) -> bool:
    return outros_fortes or any(set(c["motivos"]) - {"nome"} for c in candidatos)


def existem_outros_fortes(utilizador, visiveis_ids, *, nif="", email="", telefones=(), excluir_id=None) -> bool:
    """Há duplicados fortes (NIF/email/telefone) em registos que o utilizador não vê?"""
    cond = Q()
    if nif:
        cond |= Q(nif="".join(nif.split()).upper())
    if email:
        cond |= Q(email=email.strip().lower())
    telefones = [t for t in telefones if t]
    if telefones:
        cond |= Q(telefones__numero_e164__in=telefones)
    if not cond:
        return False
    qs = Entidade.objects.ativos().filter(cond).exclude(pk__in=visiveis_ids)
    if excluir_id:
        qs = qs.exclude(pk=excluir_id)
    return qs.exists()
