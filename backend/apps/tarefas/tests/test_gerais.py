"""Tarefas gerais (F4-01, D-52): soltas ou ligadas às oito fichas comerciais, modelos por módulo, estados."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel
from apps.tarefas.models import ModeloTarefa, Tarefa

pytestmark = pytest.mark.django_db
HOJE = timezone.localdate()


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


@pytest.fixture
def u(criar_utilizador, equipa_norte):
    return criar_utilizador(Perfil.CONSULTOR, equipa_norte)


def test_tarefa_solta_e_ligada_a_ficha(api, u, criar_utilizador, equipa_sul):
    api.force_authenticate(u)
    url = reverse("tarefa-list")
    r = api.post(url, {"titulo": "Preparar apresentação"}, format="json")
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["referencia"].startswith("TAR-") and d["pos_venda"] is False and d["origem"] is None
    assert d["estado_categoria"] == "aberta"
    assert Tarefa.objects.get(pk=d["id"]).categoria.categoria == "geral"
    ana = Entidade.objects.create(nome="Ana Cliente", responsavel=u)
    r = api.post(url, {"titulo": "Ligar à Ana", "origem_modulo": "entidades", "origem_id": ana.pk}, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["origem"]["caminho"] == f"/entidades/{ana.pk}" and "Ana Cliente" in r.json()["origem"]["titulo"]
    lista = api.get(url, {"origem_modulo": "entidades", "origem_id": ana.pk}).json()["results"]
    assert [x["titulo"] for x in lista] == ["Ligar à Ana"]
    # Só o módulo ou só o registo: recusado. Categoria de pós-venda sem transação: recusada.
    assert api.post(url, {"titulo": "X", "origem_modulo": "entidades"}, format="json").status_code == 400
    r = api.post(url, {"titulo": "X", "categoria": v("categorias_tarefa", "Pós-venda").pk}, format="json")
    assert r.status_code == 400 and "categoria" in r.json()
    # Ficha a que não tem acesso: recusada.
    outro = criar_utilizador(Perfil.CONSULTOR, equipa_sul)
    alheia = Entidade.objects.create(nome="Alheia", responsavel=outro)
    r = api.post(url, {"titulo": "X", "origem_modulo": "entidades", "origem_id": alheia.pk}, format="json")
    assert r.status_code == 400 and "origem_id" in r.json()
    # O outro consultor não vê as tarefas deste.
    api.force_authenticate(outro)
    assert api.get(url, {"vista": "todas"}).json()["results"] == []


def test_concluir_e_reabrir_com_motivo(api, u):
    api.force_authenticate(u)
    d = api.post(
        reverse("tarefa-list"), {"titulo": "Rever contrato", "prazo": str(HOJE - timedelta(days=1))}, format="json"
    ).json()
    assert d["atrasada"] is True
    url = reverse("tarefa-mudar-estado", args=[d["id"]])
    r = api.post(url, {"estado": v("estados_tarefa", "Concluída").pk}, format="json")
    assert r.status_code == 200 and r.json()["concluida_em"] and r.json()["atrasada"] is False
    assert api.post(url, {"estado": v("estados_tarefa", "Por fazer").pk}, format="json").status_code == 400
    r = api.post(url, {"estado": v("estados_tarefa", "Por fazer").pk, "motivo": "Falta a assinatura"}, format="json")
    assert (
        r.status_code == 200 and r.json()["concluida_em"] is None and r.json()["motivo_estado"] == "Falta a assinatura"
    )
    assert api.post(url, {"estado": v("estados_tarefa", "Cancelada").pk}, format="json").status_code == 400
    # O estado não muda pela edição normal.
    t = api.get(reverse("tarefa-detail", args=[d["id"]])).json()
    r = api.patch(
        reverse("tarefa-detail", args=[d["id"]]),
        {"estado": v("estados_tarefa", "Concluída").pk, "versao": t["versao"]},
        format="json",
    )
    assert r.json()["estado_categoria"] == "aberta"
    kanban = api.get(reverse("tarefa-kanban")).json()
    assert [x["id"] for x in kanban] == [d["id"]]


def test_modelos_por_modulo(api, u, criar_utilizador):
    admin = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(admin)
    r = api.post(
        reverse("modelo-tarefa-list"), {"modulo": "imoveis", "nome": "Tirar fotografias", "dias_apos": 3}, format="json"
    )
    assert r.status_code == 201 and r.json()["modulo_nome"] == "Imóveis"
    imovel = Imovel.objects.create(responsavel=u, localidade="Maia")
    api.force_authenticate(u)
    proposta = api.get(reverse("tarefa-proposta"), {"origem_modulo": "imoveis", "origem_id": imovel.pk}).json()
    assert [m["nome"] for m in proposta] == ["Tirar fotografias"]  # só os modelos deste módulo
    corpo = {"origem_modulo": "imoveis", "origem_id": imovel.pk, "modelos": [proposta[0]["id"]]}
    r = api.post(reverse("tarefa-criar-de-modelos"), corpo, format="json")
    assert r.status_code == 201, r.content
    t = Tarefa.objects.get(origem_modulo="imoveis")
    assert t.prazo == HOJE + timedelta(days=3) and t.responsavel == u and t.modelo.nome == "Tirar fotografias"
    assert api.post(reverse("tarefa-criar-de-modelos"), corpo, format="json").json() == []  # sem duplicar
    # Os modelos de imóveis não são propostos ao concluir transações (só os de pós-venda).
    assert ModeloTarefa.objects.filter(modulo="pos-venda").count() == 3


def test_agenda_mostra_tarefas_gerais(api, u):
    api.force_authenticate(u)
    d = api.post(reverse("tarefa-list"), {"titulo": "Enviar proposta", "prazo": str(HOJE)}, format="json").json()
    ev = api.get(reverse("compromisso-eventos"), {"inicio": str(HOJE), "fim": str(HOJE)}).json()
    assert [(e["titulo"], e["caminho"]) for e in ev] == [("Enviar proposta", f"/tarefas/{d['id']}")]
