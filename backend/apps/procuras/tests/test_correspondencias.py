from decimal import Decimal

import pytest
from django.urls import reverse

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel
from apps.localizacao.models import Concelho, Distrito, Freguesia
from apps.procuras.models import Procura

pytestmark = pytest.mark.django_db


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


@pytest.fixture
def pessoas(criar_utilizador, equipa_norte):
    class P:
        cons = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
        cons2 = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
        resp = criar_utilizador(Perfil.RESPONSAVEL, equipa_norte)

    return P


@pytest.fixture
def geo():
    # Localizações FICTÍCIAS (só para testes).
    d = Distrito.objects.create(codigo="99", nome="Distrito Ensaio")
    c1 = Concelho.objects.create(codigo="9901", nome="Concelho A", distrito=d)
    c2 = Concelho.objects.create(codigo="9902", nome="Concelho B", distrito=d)
    return {
        "c1": c1,
        "c2": c2,
        "f1": Freguesia.objects.create(codigo="990101", nome="Freguesia A1", concelho=c1),
        "f2": Freguesia.objects.create(codigo="990201", nome="Freguesia B1", concelho=c2),
    }


def imovel(u, **kw):
    base = {
        "responsavel": u,
        "operacao": v("operacoes", "Venda"),
        "status": v("status_imovel", "Ativo"),
        "estado_comercializacao": v("estados_comercializacao", "Disponível"),
        "tipo": v("tipos_imovel", "Apartamento"),
        "tipologia": v("tipologias", "T2"),
        "preco": Decimal("250000"),
        "localidade": "Ensaio",
    }
    base.update(kw)
    zonas = base.pop("zonas", [])
    i = Imovel.objects.create(**base)
    i.zonas_exteriores.set(zonas)
    return i


def procura(u, **kw):
    m2m = {
        k: kw.pop(k) for k in list(kw) if k in ("tipos", "tipologias", "concelhos", "freguesias", "zonas_exteriores")
    }
    base = {
        "responsavel": u,
        "entidade": Entidade.objects.create(nome="Comprador Ensaio", responsavel=u),
        "pretende": "comprar",
        "estado": v("estados_procura", "Ativa"),
    }
    base.update(kw)
    p = Procura.objects.create(**base)
    for k, val in m2m.items():
        getattr(p, k).set(val)
    return p


def resultados(api, u, p):
    api.force_authenticate(u)
    r = api.get(reverse("procura-correspondencias", args=[p.pk]))
    assert r.status_code == 200, r.content
    return r.json()["resultados"]


def ids(res):
    return [r["imovel"]["id"] for r in res]


class TestOrcamento:
    def test_teto_20_por_cento_exemplo_da_especificacao(self, api, pessoas):
        """AT-10: 250 000 € + 20% = teto 300 000 €; acima do teto é excluído."""
        dentro = imovel(pessoas.cons, preco=Decimal("250000"))
        tolerancia = imovel(pessoas.cons, preco=Decimal("300000"))
        acima = imovel(pessoas.cons, preco=Decimal("300000.01"))
        p = procura(pessoas.cons, orcamento_max=Decimal("250000"), tolerancia_pct=Decimal("20"))
        assert p.teto == Decimal("300000.00")
        res = resultados(api, pessoas.cons, p)
        assert ids(res) == [dentro.pk, tolerancia.pk]
        assert acima.pk not in ids(res)
        assert res[0]["grupo_preco"] == 0 and res[1]["grupo_preco"] == 1

    def test_tolerancia_zero_por_omissao(self, api, pessoas):
        imovel(pessoas.cons, preco=Decimal("250001"))
        p = procura(pessoas.cons, orcamento_max=Decimal("250000"))
        assert p.tolerancia_pct == 0
        assert resultados(api, pessoas.cons, p) == []

    def test_tolerancia_maior_que_20_recusada(self, api, pessoas):
        api.force_authenticate(pessoas.cons)
        e = Entidade.objects.create(nome="X", responsavel=pessoas.cons)
        r = api.post(
            reverse("procura-list"),
            {"entidade": e.pk, "pretende": "comprar", "tolerancia_pct": "20.5"},
            format="json",
        )
        assert r.status_code == 400 and "tolerancia_pct" in r.json()

    def test_preco_desconhecido_fica_depois_e_assinalado(self, api, pessoas):
        sem_preco = imovel(pessoas.cons, preco=None)
        com_preco = imovel(pessoas.cons, preco=Decimal("200000"))
        res = resultados(api, pessoas.cons, procura(pessoas.cons, orcamento_max=Decimal("250000")))
        assert ids(res) == [com_preco.pk, sem_preco.pk]
        assert res[1]["obrigatorios_por_confirmar"] == 1


class TestCriterios:
    def test_obrigatorio_exclui_e_preferencial_ordena(self, api, pessoas):
        t2 = imovel(pessoas.cons, tipologia=v("tipologias", "T2"))
        t3 = imovel(pessoas.cons, tipologia=v("tipologias", "T3"))
        moradia = imovel(pessoas.cons, tipo=v("tipos_imovel", "Moradia"), tipologia=v("tipologias", "T3"))
        p = procura(
            pessoas.cons,
            tipos=[v("tipos_imovel", "Apartamento")],
            imp_tipos="obrigatorio",
            tipologias=[v("tipologias", "T3")],
            imp_tipologias="preferencial",
        )
        res = resultados(api, pessoas.cons, p)
        assert moradia.pk not in ids(res)  # obrigatório não cumprido
        assert ids(res) == [t3.pk, t2.pk]  # preferência cumprida primeiro
        explic = {c["criterio"]: c["estado"] for c in res[1]["criterios"]}
        assert explic == {"tipo": "cumpre", "tipologia": "nao_cumpre"}

    def test_concelho_inteiro_e_freguesia_especifica(self, api, pessoas, geo):
        em_c1 = imovel(pessoas.cons, freguesia=geo["f1"])
        em_c2 = imovel(pessoas.cons, freguesia=geo["f2"])
        sem_local = imovel(pessoas.cons)
        p = procura(pessoas.cons, concelhos=[geo["c1"]], imp_localizacao="obrigatorio")
        res = resultados(api, pessoas.cons, p)
        assert ids(res) == [em_c1.pk, sem_local.pk]
        assert em_c2.pk not in ids(res)
        p2 = procura(pessoas.cons, freguesias=[geo["f2"]], imp_localizacao="obrigatorio")
        assert em_c2.pk in ids(resultados(api, pessoas.cons, p2))

    def test_quartos_area_elevador_zonas(self, api, pessoas):
        bom = imovel(pessoas.cons, quartos=3, area_bruta_privativa=Decimal("100"), elevador=True,
                     zonas=[v("zonas_exteriores", "Varanda")])  # fmt: skip
        pequeno = imovel(pessoas.cons, quartos=1, area_bruta_privativa=Decimal("40"), elevador=False)
        p = procura(
            pessoas.cons, quartos_min=2, imp_quartos="obrigatorio", area_min=Decimal("80"), imp_area="preferencial",
            exige_elevador=True, imp_elevador="preferencial", zonas_exteriores=[v("zonas_exteriores", "Varanda")],
            imp_zonas_exteriores="preferencial",
        )  # fmt: skip
        res = resultados(api, pessoas.cons, p)
        assert ids(res) == [bom.pk]
        assert res[0]["preferencias_cumpridas"] == 3 and res[0]["preferencias_total"] == 3
        assert pequeno.pk not in ids(res)


class TestElegibilidade:
    def test_operacao_estado_e_status(self, api, pessoas):
        ok = imovel(pessoas.cons)
        imovel(pessoas.cons, operacao=v("operacoes", "Arrendamento"))
        imovel(pessoas.cons, estado_comercializacao=v("estados_comercializacao", "Vendido"))
        imovel(pessoas.cons, estado_comercializacao=v("estados_comercializacao", "Reservado"))
        imovel(pessoas.cons, status=v("status_imovel", "Arquivado"))
        prep = imovel(pessoas.cons, estado_comercializacao=v("estados_comercializacao", "Em preparação"))
        assert set(ids(resultados(api, pessoas.cons, procura(pessoas.cons)))) == {ok.pk, prep.pk}

    def test_so_imoveis_visiveis_ao_utilizador(self, api, pessoas):
        imovel(pessoas.cons2)
        p = procura(pessoas.cons)
        assert resultados(api, pessoas.cons, p) == []
        # O responsável de equipa vê a procura e o imóvel do colega.
        assert len(resultados(api, pessoas.resp, p)) == 1

    def test_procuras_compativeis_na_ficha_do_imovel(self, api, pessoas):
        i = imovel(pessoas.cons, preco=Decimal("260000"))
        boa = procura(pessoas.cons, orcamento_max=Decimal("250000"), tolerancia_pct=Decimal("10"))
        procura(pessoas.cons, orcamento_max=Decimal("200000"))
        procura(pessoas.cons, orcamento_max=Decimal("300000"), estado=v("estados_procura", "Em pausa"))
        api.force_authenticate(pessoas.cons)
        r = api.get(reverse("imovel-procuras-compativeis", args=[i.pk])).json()
        assert [x["procura"]["id"] for x in r] == [boa.pk]
        assert r[0]["procura"]["entidade"] == "Comprador Ensaio"


def test_comprar_encontra_todas_as_operacoes_de_venda_e_arrendar_as_de_arrendamento(api, pessoas):
    from apps.configuracao.models import Lista

    leilao = ValorLista.objects.create(
        lista=Lista.objects.get(chave="operacoes"), nome="Venda em leilão", categoria="venda"
    )
    venda = imovel(pessoas.cons)
    em_leilao = imovel(pessoas.cons, operacao=leilao)
    arrendar = imovel(pessoas.cons, operacao=v("operacoes", "Arrendamento"))
    assert set(ids(resultados(api, pessoas.cons, procura(pessoas.cons)))) == {venda.pk, em_leilao.pk}
    assert ids(resultados(api, pessoas.cons, procura(pessoas.cons, pretende="arrendar"))) == [arrendar.pk]
