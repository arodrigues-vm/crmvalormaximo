from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.agentes.models import Agencia, Agente
from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel, Proprietario
from apps.propostas.models import Proposta
from apps.visitas.models import Visita

pytestmark = pytest.mark.django_db
HOJE = timezone.localdate()


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome).pk


@pytest.fixture
def u(criar_utilizador):
    return criar_utilizador(Perfil.CONSULTOR)


@pytest.fixture
def cenario(u):
    nossa = Agencia.objects.create(nome="Valor Máximo Ensaio", tipo_id=v("tipos_agencia", "Própria"), responsavel=u)
    agente = Agente.objects.create(nome="Consultor Ensaio", agencia=nossa, utilizador=u, responsavel=u)
    comprador = Entidade.objects.create(nome="Bruno Comprador", responsavel=u)
    dona = Entidade.objects.create(nome="Ana Proprietária", responsavel=u)
    imovel = Imovel.objects.create(responsavel=u, localidade="Maia", preco=Decimal("250000"))
    Proprietario.objects.create(imovel=imovel, entidade=dona, quota=100)
    visita = Visita.objects.create(
        imovel=imovel, entidade=comprador, data=HOJE, responsavel=u, agente_comprador=agente, agente_imovel=agente
    )

    class C:
        pass

    C.agente, C.comprador, C.dona, C.imovel, C.visita = agente, comprador, dona, imovel, visita
    return C


def corpo(c, **extra):
    base = {
        "visita": c.visita.pk, "imovel": c.imovel.pk, "entidade": c.comprador.pk,
        "agente_comprador": c.agente.pk, "agente_imovel": c.agente.pk,
        "ronda_inicial": {"autor": "comprador", "valor": "230000", "sinal_valor": "10", "sinal_unidade": "percentagem",
                          "modo_pagamento": v("modos_pagamento", "Financiamento"),
                          "data_cpcv": str(HOJE + timedelta(days=30)),
                          "data_escritura": str(HOJE + timedelta(days=90))},
    }  # fmt: skip
    base.update(extra)
    return base


def test_previa_nao_grava_e_preenche_participantes(api, u, cenario):
    api.force_authenticate(u)
    r = api.get(reverse("proposta-previa"), {"visita": cenario.visita.pk})
    assert r.status_code == 200, r.content
    d = r.json()
    assert [p["nome"] for p in d["participantes"]] == ["Bruno Comprador", "Ana Proprietária"]
    assert d["participantes"][1]["quota"] == "100.0000" and d["valor_sugerido"] == "250000.00"
    assert Proposta.objects.count() == 0


def test_gerar_proposta_da_visita_sem_duplicados(api, u, cenario):
    api.force_authenticate(u)
    previa = api.get(reverse("proposta-previa"), {"visita": cenario.visita.pk}).json()
    participantes = [
        {"entidade": p["entidade"], "papel": p["papel"], "quota": p["quota"]} for p in previa["participantes"]
    ]
    r = api.post(reverse("proposta-list"), corpo(cenario, participantes=participantes), format="json")
    assert r.status_code == 201, r.content
    p = r.json()
    assert p["referencia"].startswith("PRP-") and p["estado_nome"] == "Em negociação"
    assert p["valor_atual"] == "230000.00" and len(p["rondas"]) == 1
    assert [x["papel_nome"] for x in p["participantes_detalhe"]] == ["Comprador", "Proprietário"]
    # Proteção contra duplicados (AT-08).
    assert api.post(reverse("proposta-list"), corpo(cenario), format="json").status_code == 400
    assert api.get(reverse("proposta-previa"), {"visita": cenario.visita.pk}).status_code == 409
    # Fotografia: mudar os proprietários do imóvel não altera a proposta (AT-11).
    cenario.imovel.proprietarios.all().delete()
    detalhe = api.get(reverse("proposta-detail", args=[p["id"]])).json()
    assert [x["nome"] for x in detalhe["participantes_detalhe"]] == ["Bruno Comprador", "Ana Proprietária"]


def test_rondas_e_estados(api, u, cenario):
    api.force_authenticate(u)
    p = api.post(reverse("proposta-list"), corpo(cenario), format="json").json()
    url = reverse("proposta-rondas", args=[p["id"]])
    r = api.post(url, {"autor": "proprietario", "valor": "245000", "condicoes": "Mantém os móveis"}, format="json")
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["valor_atual"] == "245000.00" and d["ultima_ronda_autor"] == "Proprietário" and len(d["rondas"]) == 2
    assert RegistoAuditoria.objects.filter(acao="proposta.ronda").count() == 1
    aceite = api.patch(
        reverse("proposta-detail", args=[p["id"]]), {"estado": v("estados_proposta", "Aceite"), "versao": d["versao"]},
        format="json",
    )  # fmt: skip
    assert aceite.status_code == 200
    # Proposta aceite já não recebe rondas.
    assert api.post(url, {"autor": "comprador", "valor": "240000"}, format="json").status_code == 400


def test_so_uma_aceite_por_imovel_e_imovel_externo(api, u, cenario):
    api.force_authenticate(u)
    corpo1 = corpo(cenario, visita=None, estado=v("estados_proposta", "Aceite"))
    assert api.post(reverse("proposta-list"), corpo1, format="json").status_code == 201
    r = api.post(
        reverse("proposta-list"), corpo(cenario, visita=None, estado=v("estados_proposta", "Aceite")), format="json"
    )
    assert r.status_code == 400 and "estado" in str(r.json())
    externo = corpo(cenario, visita=None, imovel=None, imovel_descricao="Moradia T4", imovel_localizacao="Matosinhos")
    r = api.post(reverse("proposta-list"), externo, format="json")
    assert r.status_code == 201 and r.json()["imovel_descricao_completa"] == "Moradia T4 · Matosinhos"


def test_validacoes(api, u, cenario):
    api.force_authenticate(u)
    assert api.post(reverse("proposta-list"), corpo(cenario, ronda_inicial=None), format="json").status_code == 400
    sem = corpo(cenario)
    del sem["ronda_inicial"]
    assert api.post(reverse("proposta-list"), sem, format="json").status_code == 400
    mau = corpo(cenario)
    mau["ronda_inicial"] = {**mau["ronda_inicial"], "data_escritura": str(HOJE)}
    r = api.post(reverse("proposta-list"), mau, format="json")
    assert r.status_code == 400 and "data_escritura" in str(r.json())


def test_sem_acesso(api, u, cenario, criar_utilizador):
    outro = criar_utilizador(Perfil.CONSULTOR)
    api.force_authenticate(outro)
    assert api.get(reverse("proposta-previa"), {"visita": cenario.visita.pk}).status_code == 404
