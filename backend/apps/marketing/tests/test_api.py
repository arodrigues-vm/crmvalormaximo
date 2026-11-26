"""Plano de Marketing de Imóveis (F4-03, Cap. 18, D-53, AT-05)."""

from collections import Counter
from datetime import date, timedelta

import pytest
from django.urls import reverse

from apps.angariacoes.models import Angariacao
from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.imoveis.models import Imovel
from apps.marketing.catalogo import CATALOGO
from apps.marketing.models import PlanoMarketing
from apps.marketing.servicos import cor
from apps.tarefas.models import Tarefa

pytestmark = pytest.mark.django_db
INICIO = date(2026, 11, 2)


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


@pytest.fixture
def u(criar_utilizador, equipa_norte):
    return criar_utilizador(Perfil.CONSULTOR, equipa_norte)


@pytest.fixture
def cmi(u, criar_utilizador, equipa_norte):
    """`u` é o responsável do imóvel; o CMI é de outro consultor (partilhado com `u`)."""
    outro = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
    imovel = Imovel.objects.create(responsavel=u, localidade="Maia")
    a = Angariacao.objects.create(imovel=imovel, responsavel=outro, data_inicio=INICIO, prazo_meses=6)
    a.partilhada_com.add(u)
    return a


def criar(api, cmi, **extra):
    return api.post(reverse("plano-marketing-list"), {"angariacao": cmi.pk, **extra}, format="json")


def test_catalogo_original_at05():
    """45 ocorrências, 8 semanas, designações literais e repetições independentes."""
    assert len(CATALOGO) == 45 and [n for n, _, _ in CATALOGO] == list(range(1, 46))
    por_semana = Counter(s for _, s, _ in CATALOGO)
    assert dict(por_semana) == {1: 8, 2: 5, 3: 4, 4: 3, 5: 9, 6: 5, 7: 5, 8: 6}
    nomes = Counter(d for _, _, d in CATALOGO)
    assert nomes["Buyer/Seller match"] == 5 and nomes["Republicar no site da marca com troca de fotos"] == 5
    assert CATALOGO[0][2] == "Análise Concorencia" and CATALOGO[4][2] == "Reportagem videográfiva"  # grafias originais


def test_cores_dos_indicadores():
    assert [cor(0, 0), cor(3, 0), cor(3, 1), cor(3, 3)] == ["neutro", "vermelho", "amarelo", "verde"]


def test_previa_e_criacao_com_offsets_e_inclusao(api, u, cmi):
    api.force_authenticate(u)
    r = api.get(reverse("plano-marketing-previa"), {"angariacao": cmi.pk})
    assert r.status_code == 200, r.content
    d = r.json()
    assert len(d["ocorrencias"]) == 45 and all(o["incluida"] for o in d["ocorrencias"])
    assert d["responsavel"] == u.pk != cmi.responsavel_id  # responsável do imóvel (escolha do proprietário)
    assert PlanoMarketing.objects.count() == 0  # a prévia não grava nada
    r = criar(api, cmi, excluidos=[7, 13])
    assert r.status_code == 201, r.content
    p = r.json()
    assert p["referencia"].startswith("PMK-") and p["data_base"] == str(INICIO)
    oc = {o["mk_numero"]: o for o in p["ocorrencias"]}
    assert len(oc) == 45 and oc[7]["incluida"] is False and oc[13]["incluida"] is False
    for n, s, desig in CATALOGO:
        assert oc[n]["titulo"] == desig and oc[n]["prazo"] == str(INICIO + timedelta(days=7 * (s - 1)))
    ind = p["indicadores"]
    assert ind["incluidas"] == 43 and ind["concluidas"] == 0 and ind["cor"] == "vermelho"
    assert [s["incluidas"] for s in ind["semanas"]] == [7, 4, 4, 3, 9, 5, 5, 6]
    # Sem duplicar: segundo pedido recusado.
    assert criar(api, cmi).status_code == 400
    assert api.get(reverse("plano-marketing-previa"), {"angariacao": cmi.pk}).status_code == 409


def test_cmi_nao_assinado_nao_cria(api, u, cmi):
    api.force_authenticate(u)
    cmi.prazo_meses = None
    cmi.save()
    r = api.get(reverse("plano-marketing-previa"), {"angariacao": cmi.pk})
    assert r.status_code == 409 and "assinado" in r.json()["detail"]
    assert criar(api, cmi).status_code == 400


def test_ocorrencias_partilhadas_com_tarefas_e_agenda(api, u, cmi, criar_utilizador):
    admin = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(admin)
    p = criar(api, cmi, excluidos=[2]).json()
    t1 = next(o for o in p["ocorrencias"] if o["mk_numero"] == 1)
    # A mesma tarefa no menu Tarefas (sem as não incluídas).
    lista = api.get(reverse("tarefa-list"), {"tipo": "marketing", "vista": "todas"}).json()
    assert lista["count"] == 44
    # Concluir na tarefa reflete-se nos contadores do plano.
    r = api.post(
        reverse("tarefa-mudar-estado", args=[t1["id"]]), {"estado": v("estados_tarefa", "Concluída").pk}, format="json"
    )
    assert r.status_code == 200
    p = api.get(reverse("plano-marketing-detail", args=[p["id"]])).json()
    assert p["indicadores"]["semanas"][0] == {"semana": 1, "incluidas": 7, "concluidas": 1, "cor": "amarelo"}
    # A designação não se altera; a tarefa não se apaga; uma concluída não se desmarca.
    t = api.get(reverse("tarefa-detail", args=[t1["id"]])).json()
    r = api.patch(reverse("tarefa-detail", args=[t1["id"]]), {"titulo": "Outro", "versao": t["versao"]}, format="json")
    assert r.status_code == 400
    assert api.delete(reverse("tarefa-detail", args=[t1["id"]])).status_code == 400
    url = reverse("plano-marketing-incluir", args=[p["id"]])
    assert api.post(url, {"tarefa": t1["id"], "incluida": False}, format="json").status_code == 400
    t2 = next(o for o in p["ocorrencias"] if o["mk_numero"] == 2)
    r = api.post(url, {"tarefa": t2["id"], "incluida": True}, format="json")
    assert r.json()["indicadores"]["semanas"][0]["incluidas"] == 8
    # Agenda: só a pedido («Mostrar tarefas de marketing»).
    ev = {"inicio": str(INICIO), "fim": str(INICIO)}
    assert api.get(reverse("compromisso-eventos"), ev).json() == []
    # Semana 1 (8 ocorrências, todas incluídas agora): aparecem todas no dia (a concluída também).
    assert len(api.get(reverse("compromisso-eventos"), {**ev, "marketing": "1"}).json()) == 8


def test_recalculo_pedido_e_aprovado_por_outra_pessoa(api, u, cmi, criar_utilizador, equipa_norte):
    api.force_authenticate(u)
    p = criar(api, cmi).json()
    primeira = next(o for o in p["ocorrencias"] if o["mk_numero"] == 1)
    api.post(
        reverse("tarefa-mudar-estado", args=[primeira["id"]]),
        {"estado": v("estados_tarefa", "Concluída").pk},
        format="json",
    )
    url_pedir = reverse("plano-marketing-pedir-recalculo", args=[p["id"]])
    assert api.post(url_pedir, {"motivo": "x"}, format="json").status_code == 400  # data igual
    cmi.data_inicio = INICIO + timedelta(days=3)
    cmi.save()
    previa = api.get(reverse("plano-marketing-previa-recalculo", args=[p["id"]])).json()
    assert len(previa["ocorrencias"]) == 44  # as concluídas não entram
    r = api.post(url_pedir, {"motivo": "Data de início corrigida"}, format="json")
    assert r.status_code == 201 and r.json()["pedido_pendente"]["data_base_nova"] == str(INICIO + timedelta(days=3))
    assert api.post(url_pedir, {"motivo": "outra vez"}, format="json").status_code == 400  # já há pendente
    url_decidir = reverse("plano-marketing-decidir-recalculo", args=[p["id"]])
    assert api.post(url_decidir, {"aprovar": True}, format="json").status_code == 403  # consultor não aprova
    chefe = criar_utilizador(Perfil.RESPONSAVEL, equipa_norte)
    api.force_authenticate(chefe)
    r = api.post(url_decidir, {"aprovar": True}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["data_base"] == str(INICIO + timedelta(days=3)) and d["pedido_pendente"] is None
    oc = {o["mk_numero"]: o for o in d["ocorrencias"]}
    assert oc[1]["prazo"] == str(INICIO)  # concluída preservada
    assert oc[9]["prazo"] == str(INICIO + timedelta(days=3 + 7))
    assert Tarefa.objects.filter(plano_id=p["id"]).count() == 45
