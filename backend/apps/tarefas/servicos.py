"""Pós-venda: propostas de tarefas a partir dos modelos (D-50)."""

from datetime import timedelta

from apps.configuracao.models import ValorLista
from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import ambito_efetivo
from apps.core.auditoria import registar

from .models import ModeloTarefa, Tarefa

MODULO = "pos-venda"


def valor_categoria(chave, categoria):
    return (
        ValorLista.objects.filter(lista__chave=chave, categoria=categoria, ativo=True).order_by("ordem", "id").first()
    )


def pode_criar(utilizador) -> bool:
    return ambito_efetivo(utilizador, MODULO, Operacao.CRIAR) != Ambito.NENHUM


def modelos_por_usar(transacao):
    """Modelos ativos que ainda não deram tarefa nesta transação."""
    usados = set(transacao.tarefas.filter(eliminado_em__isnull=True).values_list("modelo_id", flat=True))
    return [m for m in ModeloTarefa.objects.filter(ativo=True) if m.pk not in usados]


def responsavel_omissao(transacao):
    """O responsável pelo comprador (D-46); se o comprador é de outra agência, o da transação."""
    return transacao.consultor_comprador or transacao.responsavel


def criar_de_modelo(transacao, modelo, utilizador, data_marco, request=None) -> Tarefa:
    t = Tarefa.objects.create(
        titulo=modelo.nome,
        descricao=modelo.descricao,
        categoria=valor_categoria("categorias_tarefa", "pos_venda"),
        estado=valor_categoria("estados_tarefa", "aberta"),
        prazo=(data_marco + timedelta(days=modelo.dias_apos)) if data_marco else None,
        transacao=transacao,
        modelo=modelo,
        responsavel=responsavel_omissao(transacao),
        criado_por=utilizador,
        atualizado_por=utilizador,
    )
    registar("tarefa.criado", modulo=MODULO, objeto=t, request=request,
             dados={"origem": f"Modelo «{modelo.nome}» da transação {transacao.referencia}"})  # fmt: skip
    return t
