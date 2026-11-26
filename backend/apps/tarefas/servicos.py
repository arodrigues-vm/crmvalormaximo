"""Tarefas: serviço único para Tarefas gerais (D-52) e Pós-Venda (D-50).

- Uma tarefa com `transacao` é de **pós-venda** (permissões do módulo «pos-venda»); as restantes são **gerais**
  (módulo «tarefas»), soltas ou ligadas a uma ficha de um dos oito módulos comerciais.
- Os modelos de tarefa são por módulo; só se criam as tarefas confirmadas.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from apps.configuracao.models import ValorLista
from apps.configuracao.personalizados import modelo_do_ecra, registos_visiveis, titulo_registo
from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import ambito_efetivo, filtrar, pode
from apps.core.auditoria import registar

from .models import ORIGENS, ModeloTarefa, Tarefa

MODULO = "pos-venda"
MODULO_GERAL = "tarefas"
MODULO_MARKETING = "marketing-imoveis"
MODULO_MK_ENTIDADES = "marketing-entidades"
NOMES_ORIGEM = dict(ORIGENS)
ABERTAS = ("aberta", "em_curso")
FECHADAS = ("concluida", "cancelada", "substituida")


def valor_categoria(chave, categoria):
    return (
        ValorLista.objects.filter(lista__chave=chave, categoria=categoria, ativo=True).order_by("ordem", "id").first()
    )


def pode_criar(utilizador) -> bool:
    return ambito_efetivo(utilizador, MODULO, Operacao.CRIAR) != Ambito.NENHUM


def visiveis(utilizador, operacao, qs):
    """Tarefas a que o utilizador tem acesso, cada tipo pelo seu módulo: gerais («tarefas»), de pós-venda
    («pos-venda») e do Plano de Marketing («marketing-imoveis»)."""
    kw = {"campo_partilhas": "partilhada_com"}
    soltas = qs.filter(transacao__isnull=True, plano__isnull=True, inscricao__isnull=True)
    gerais = filtrar(utilizador, MODULO_GERAL, operacao, soltas, **kw)
    mke = filtrar(utilizador, MODULO_MK_ENTIDADES, operacao, qs.filter(inscricao__isnull=False), **kw)
    pv = filtrar(utilizador, MODULO, operacao, qs.filter(transacao__isnull=False), **kw)
    mk = filtrar(utilizador, MODULO_MARKETING, operacao, qs.filter(plano__isnull=False), **kw)
    return qs.filter(
        Q(pk__in=gerais.values("pk")) | Q(pk__in=pv.values("pk")) | Q(pk__in=mk.values("pk"))
        | Q(pk__in=mke.values("pk"))
    )  # fmt: skip


def pode_algum(utilizador, operacao) -> bool:
    return any(pode(utilizador, m, operacao) for m in (MODULO_GERAL, MODULO, MODULO_MARKETING, MODULO_MK_ENTIDADES))


def modelos_por_usar(transacao):
    """Modelos de pós-venda ativos que ainda não deram tarefa nesta transação."""
    usados = set(transacao.tarefas.filter(eliminado_em__isnull=True).values_list("modelo_id", flat=True))
    return [m for m in ModeloTarefa.objects.filter(ativo=True, modulo=MODULO) if m.pk not in usados]


def obter_origem(utilizador, modulo, pk):
    """Registo de origem, se existir e o utilizador o puder consultar; senão None."""
    if modulo not in NOMES_ORIGEM or not pk or int(pk) not in registos_visiveis(utilizador, modulo, [int(pk)]):
        return None
    return modelo_do_ecra(modulo).objects.get(pk=pk)


def descrever_origem(utilizador, t) -> dict | None:
    if not t.origem_modulo or not t.origem_id:
        return None
    obj = obter_origem(utilizador, t.origem_modulo, t.origem_id)
    return {
        "modulo": t.origem_modulo,
        "modulo_nome": NOMES_ORIGEM.get(t.origem_modulo, t.origem_modulo),
        "id": t.origem_id,
        "titulo": titulo_registo(obj) if obj else "Registo sem acesso",
        "caminho": f"/{t.origem_modulo}/{t.origem_id}" if obj else None,
    }


def modelos_por_usar_origem(modulo, pk):
    usados = set(Tarefa.objects.ativos().filter(origem_modulo=modulo, origem_id=pk).values_list("modelo_id", flat=True))
    return [m for m in ModeloTarefa.objects.filter(ativo=True, modulo=modulo) if m.pk not in usados]


def criar_de_modelo_origem(modulo, obj, modelo, utilizador, request=None) -> Tarefa:
    """Tarefa geral a partir de um modelo do módulo: prazo = hoje + dias; responsável = o da ficha."""
    responsavel = getattr(obj, "responsavel", None)
    if responsavel is None or not responsavel.is_active:
        responsavel = utilizador
    t = Tarefa.objects.create(
        titulo=modelo.nome,
        descricao=modelo.descricao,
        categoria=valor_categoria("categorias_tarefa", "geral"),
        estado=valor_categoria("estados_tarefa", "aberta"),
        prazo=timezone.localdate() + timedelta(days=modelo.dias_apos),
        origem_modulo=modulo,
        origem_id=obj.pk,
        modelo=modelo,
        responsavel=responsavel,
        criado_por=utilizador,
        atualizado_por=utilizador,
    )
    registar("tarefa.criado", modulo=MODULO_GERAL, objeto=t, request=request,
             dados={"origem": f"Modelo «{modelo.nome}» de {titulo_registo(obj)}"})  # fmt: skip
    return t


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
