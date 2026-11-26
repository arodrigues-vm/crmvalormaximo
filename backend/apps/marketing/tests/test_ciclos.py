"""Renovação e novo ciclo de marketing (F4-04, Cap. 19, D-54)."""

from datetime import date, timedelta

import pytest
from django.urls import reverse

from apps.angariacoes.models import Angariacao, Renovacao
from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.imoveis.models import Imovel
from apps.marketing.models import PlanoMarketing
from apps.tarefas.models import Tarefa

pytestmark = pytest.mark.django_db
INICIO = date(2026, 5, 4)
RENOVACAO = date(2026, 11, 4)


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


@pytest.fixture
def u(criar_utilizador, equipa_norte):
    return criar_utilizador(Perfil.CONSULTOR, equipa_norte)


@pytest.fixture
def cmi(u):
    imovel = Imovel.objects.create(responsavel=u, localidade="Maia")
    return Angariacao.objects.create(imovel=imovel, responsavel=u, data_inicio=INICIO, prazo_meses=6)


def situacao(api, cmi):
    return api.get(reverse("plano-marketing-situacao"), {"angariacao": cmi.pk}).json()


def plano_inicial(api, cmi, excluidos=()):
    p = api.post(reverse("plano-marketing-list"), {"angariacao": cmi.pk, "excluidos": list(excluidos)}, format="json")
    assert p.status_code == 201, p.content
    return p.json()


def concluir(api, tarefa_id):
    r = api.post(
        reverse("tarefa-mudar-estado", args=[tarefa_id]), {"estado": v("estados_tarefa", "Concluída").pk}, format="json"
    )
    assert r.status_code == 200, r.content


def test_sem_renovacao_nao_ha_novo_ciclo(api, u, cmi):
    api.force_authenticate(u)
    s = situacao(api, cmi)
    assert s["plano_inicial"] is True and s["novo_ciclo"] is None
    plano_inicial(api, cmi)
    assert situacao(api, cmi) == {
        "plano_inicial": False,
        "motivo_inicial": "Este CMI já tem o plano inicial.",
        "novo_ciclo": None,
    }
    r = api.get(reverse("plano-marketing-previa-ciclo"), {"angariacao": cmi.pk})
    assert r.status_code == 409


def test_novo_ciclo_selecao_anterior_e_encerrar_pendentes(api, u, cmi):
    api.force_authenticate(u)
    p1 = plano_inicial(api, cmi, excluidos=[7, 13])
    oc1 = {o["mk_numero"]: o for o in p1["ocorrencias"]}
    concluir(api, oc1[1]["id"])
    Renovacao.objects.create(angariacao=cmi, ciclo=2, forma="documento", data_inicio=RENOVACAO, prazo_meses=6)
    s = situacao(api, cmi)
    assert s["novo_ciclo"]["ciclo"] == 2 and s["novo_ciclo"]["data_inicio"] == str(RENOVACAO)
    # Prévia: origem «seleção do ciclo anterior» → as que estavam desmarcadas vêm desmarcadas.
    pv = api.get(reverse("plano-marketing-previa-ciclo"), {"angariacao": cmi.pk, "origem": "anterior"}).json()
    marcadas = {o["numero"] for o in pv["ocorrencias"] if o["incluida"]}
    assert len(marcadas) == 43 and 7 not in marcadas and 13 not in marcadas
    assert len(pv["anterior"]["pendentes"]) == 42  # 43 incluídas − 1 concluída
    assert pv["ocorrencias"][0]["prazo"] == str(RENOVACAO)
    assert PlanoMarketing.objects.count() == 1  # a prévia não grava
    excluidos = sorted(o["numero"] for o in pv["ocorrencias"] if not o["incluida"])
    corpo = {"angariacao": cmi.pk, "origem": "anterior", "destino": "encerrar", "excluidos": excluidos}
    r = api.post(reverse("plano-marketing-novo-ciclo"), corpo, format="json")
    assert r.status_code == 201, r.content
    p2 = r.json()
    assert p2["ciclo"] == 2 and p2["referencia"] != p1["referencia"] and p2["data_base"] == str(RENOVACAO)
    assert (
        p2["plano_anterior"] == p1["id"] and p2["origem_ciclo"] == "anterior" and p2["destino_pendentes"] == "encerrar"
    )
    assert p2["indicadores"]["incluidas"] == 43
    # O anterior fica inativo, com a concluída preservada e as pendentes encerradas.
    antigo = api.get(reverse("plano-marketing-detail", args=[p1["id"]])).json()
    assert antigo["ativo"] is False and antigo["ciclos_seguintes"][0]["id"] == p2["id"]
    oc = {o["mk_numero"]: o for o in antigo["ocorrencias"]}
    assert oc[1]["estado_categoria"] == "concluida" and oc[1]["prazo"] == str(INICIO)
    assert oc[2]["estado_categoria"] == "substituida"
    assert oc[7]["estado_categoria"] == "substituida"  # não incluída, mas pendente: também encerrada
    t = Tarefa.objects.get(pk=oc[2]["id"])
    assert t.motivo_estado.startswith("Não executada — Plano substituído")
    # Sem duplicar: o mesmo pedido outra vez é recusado.
    assert api.post(reverse("plano-marketing-novo-ciclo"), corpo, format="json").status_code == 400
    assert situacao(api, cmi)["novo_ciclo"] is None


def test_novo_ciclo_catalogo_e_manter_pendentes(api, u, cmi):
    api.force_authenticate(u)
    p1 = plano_inicial(api, cmi, excluidos=[7])
    Renovacao.objects.create(angariacao=cmi, ciclo=2, forma="automatica", data_inicio=RENOVACAO, prazo_meses=6)
    pv = api.get(reverse("plano-marketing-previa-ciclo"), {"angariacao": cmi.pk, "origem": "catalogo"}).json()
    assert all(o["incluida"] for o in pv["ocorrencias"])
    corpo = {"angariacao": cmi.pk, "origem": "catalogo", "destino": "manter", "excluidos": []}
    p2 = api.post(reverse("plano-marketing-novo-ciclo"), corpo, format="json").json()
    assert p2["indicadores"]["incluidas"] == 45
    antigo = api.get(reverse("plano-marketing-detail", args=[p1["id"]])).json()
    assert {o["estado_categoria"] for o in antigo["ocorrencias"]} == {"aberta"}  # mantidas ativas
    # O estado «substituída» só é usado pelo CRM.
    r = api.post(
        reverse("tarefa-mudar-estado", args=[antigo["ocorrencias"][0]["id"]]),
        {"estado": v("estados_tarefa", "Não executada — Plano substituído").pk, "motivo": "x"},
        format="json",
    )
    assert r.status_code == 400


def test_recalculo_do_ciclo_usa_a_data_da_renovacao(api, u, cmi, criar_utilizador, equipa_norte):
    api.force_authenticate(u)
    plano_inicial(api, cmi)
    r = Renovacao.objects.create(angariacao=cmi, ciclo=2, forma="documento", data_inicio=RENOVACAO, prazo_meses=6)
    corpo = {"angariacao": cmi.pk, "origem": "catalogo", "destino": "manter", "excluidos": []}
    p2 = api.post(reverse("plano-marketing-novo-ciclo"), corpo, format="json").json()
    assert p2["angariacao_data_inicio"] == str(RENOVACAO)
    r.data_inicio = RENOVACAO + timedelta(days=2)
    r.save()
    pv = api.get(reverse("plano-marketing-previa-recalculo", args=[p2["id"]])).json()
    assert pv["data_base_nova"] == str(RENOVACAO + timedelta(days=2)) and len(pv["ocorrencias"]) == 45
