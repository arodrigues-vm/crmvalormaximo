"""Comissões (F3-07, Q13, AT-07, D-48), com os exemplos do proprietário."""

from decimal import Decimal

import pytest
from django.urls import reverse

from apps.angariacoes.models import Angariacao
from apps.comissoes.models import Comissao
from apps.configuracao.models import Parametro, ValorLista
from apps.contas.models import Perfil
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel
from apps.propostas.models import Proposta
from apps.transacoes.models import Transacao

pytestmark = pytest.mark.django_db


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


@pytest.fixture
def pessoas(criar_utilizador, equipa_norte):
    class P:
        admin = criar_utilizador(Perfil.ADMINISTRADOR)
        admin2 = criar_utilizador(Perfil.ADMINISTRADOR)
        resp = criar_utilizador(Perfil.RESPONSAVEL, equipa_norte)
        ana = criar_utilizador(Perfil.CONSULTOR, equipa_norte, comissao_modo="percentagem",
                               comissao_pct_angariacao=Decimal(50), comissao_pct_venda=Decimal(50))  # fmt: skip
        rui = criar_utilizador(Perfil.CONSULTOR, equipa_norte, comissao_modo="deducao", comissao_deducao=Decimal(450))

    return P


def transacao(p, *, consultor_imovel, consultor_comprador, valor="200000", modalidade="percentagem", taxa="5",
              minimo=None, iva="23", inclui_iva=False, operacao="Venda"):  # fmt: skip
    imovel = Imovel.objects.create(responsavel=p.ana, localidade="Maia")
    cmi = Angariacao.objects.create(
        imovel=imovel, responsavel=p.ana, operacao=v("operacoes", operacao), modalidade_remuneracao=modalidade,
        valor_remuneracao=Decimal(taxa), valor_minimo_remuneracao=minimo and Decimal(minimo),
        taxa_iva=Decimal(iva), remuneracao_inclui_iva=inclui_iva,
    )  # fmt: skip
    comprador = Entidade.objects.create(nome="Bruno Comprador", responsavel=p.ana)
    proposta = Proposta.objects.create(imovel=imovel, entidade=comprador, responsavel=p.ana)
    return Transacao.objects.create(
        proposta=proposta, imovel=imovel, entidade=comprador, angariacao=cmi, operacao=v("operacoes", operacao),
        estado=v("estados_transacao", "Em preparação"), valor=Decimal(valor), responsavel=p.ana,
        consultor_imovel=consultor_imovel, consultor_comprador=consultor_comprador,
    )  # fmt: skip


def apurar(api, t):
    return api.post(reverse("comissao-list"), {"transacao": t.pk}, format="json")


def test_exemplo_do_proprietario_dois_lados_nossos(api, pessoas):
    """200.000 € × 5% = 10.000 €: 5.000 € angariação + 5.000 € venda. Ana 50% do lado da angariação = 2.500 €;
    Rui recebe o lado da venda menos 450 € da agência = 4.550 €."""
    t = transacao(pessoas, consultor_imovel=pessoas.ana, consultor_comprador=pessoas.rui)
    api.force_authenticate(pessoas.admin)
    r = apurar(api, t)
    assert r.status_code == 201, r.content
    c = r.json()
    assert c["referencia"].startswith("COM-") and c["responsavel"] == pessoas.ana.pk
    assert c["valor_calculado"] == "10000.00" and c["valor_final"] == "10000.00"
    assert c["iva"] == "2300.00" and c["total_com_iva"] == "12300.00"
    assert c["cmi_referencia"] == t.angariacao.referencia and c["modalidade"] == "percentagem"
    res = c["resumo"]
    assert res["angariacao"] == {"nosso": True, "valor": "5000.00", "consultores": "2500.00", "agencia": "2500.00"}
    assert res["venda"] == {"nosso": True, "valor": "5000.00", "consultores": "4550.00", "agencia": "450.00"}
    assert res["total_nosso"] == "10000.00" and res["total_agencia"] == "2950.00"
    assert [(b["utilizador_nome"], b["valor"]) for b in c["beneficiarios"]] == [
        (pessoas.ana.nome, "2500.00"),
        (pessoas.rui.nome, "4550.00"),
    ]
    assert apurar(api, t).status_code == 400  # uma comissão por transação


def test_so_o_lado_nosso_e_reparticao_alteravel(api, pessoas):
    """Imóvel de outra agência, comprador nosso: só controlamos o lado da venda."""
    t = transacao(pessoas, consultor_imovel=None, consultor_comprador=pessoas.ana)
    Parametro.objects.update_or_create(chave="comissao_reparticao_angariacao", defaults={
        "nome": "x", "modulo": "faturacao", "valor": 40})  # fmt: skip
    api.force_authenticate(pessoas.admin)
    c = apurar(api, t).json()
    assert c["pct_angariacao"] == "40.00"
    assert c["resumo"]["angariacao"]["nosso"] is False and c["resumo"]["venda"]["valor"] == "6000.00"
    assert c["resumo"]["total_nosso"] == "6000.00"
    assert [b["lado"] for b in c["beneficiarios"]] == ["venda"]
    url = reverse("comissao-detail", args=[c["id"]])
    r = api.patch(url, {"versao": c["versao"], "pct_angariacao": "50"}, format="json")
    assert r.json()["resumo"]["venda"]["valor"] == "5000.00"
    # Os consultores não podem receber mais do que o lado.
    demais = [{"lado": "venda", "utilizador": pessoas.ana.pk, "modo": "percentagem", "percentagem": "60"},
              {"lado": "venda", "utilizador": pessoas.rui.pk, "modo": "percentagem", "percentagem": "60"}]  # fmt: skip
    r2 = api.patch(url, {"versao": r.json()["versao"], "beneficiarios": demais}, format="json")
    assert r2.status_code == 400
    # Nem se põem consultores num lado que não é nosso.
    fora = [{"lado": "angariacao", "utilizador": pessoas.ana.pk, "modo": "percentagem", "percentagem": "10"}]
    assert api.patch(url, {"versao": r.json()["versao"], "beneficiarios": fora}, format="json").status_code == 400


def test_minimo_iva_incluido_e_rendas(api, pessoas):
    api.force_authenticate(pessoas.admin)
    # 100.000 × 2% = 2.000, mas o mínimo é 3.000; valores com IVA incluído (23%) → 2.439,02 sem IVA.
    t = transacao(pessoas, consultor_imovel=pessoas.ana, consultor_comprador=None, valor="100000", taxa="2",
                  minimo="3000", inclui_iva=True)  # fmt: skip
    assert apurar(api, t).json()["valor_calculado"] == "2439.02"
    # Arrendamento: 2 rendas × 900 € (renda mensal = valor acordado).
    t2 = transacao(pessoas, consultor_imovel=pessoas.ana, consultor_comprador=None, valor="900",
                   modalidade="numero_rendas", taxa="2", operacao="Arrendamento")  # fmt: skip
    assert apurar(api, t2).json()["valor_calculado"] == "1800.00"


def test_sem_calculo_fica_por_apurar_e_indica_se_a_mao(api, pessoas):
    t = transacao(pessoas, consultor_imovel=pessoas.ana, consultor_comprador=None, modalidade="percentagem_base")
    api.force_authenticate(pessoas.admin)
    c = apurar(api, t).json()
    assert c["valor_calculado"] is None and c["valor_final"] is None  # desconhecido, não zero
    assert c["resumo"]["angariacao"]["valor"] is None
    url = reverse("comissao-detail", args=[c["id"]])
    r = api.patch(url, {"versao": c["versao"], "valor_final": "0"}, format="json")  # zero confirmado
    assert r.json()["valor_final"] == "0.00" and r.json()["origem"] == "manual"


def test_excecao_exige_aprovacao_independente(api, pessoas):
    t = transacao(pessoas, consultor_imovel=pessoas.ana, consultor_comprador=pessoas.resp)
    api.force_authenticate(pessoas.admin)
    c = apurar(api, t).json()
    url = reverse("comissao-detail", args=[c["id"]])
    # Não se muda um valor calculado à mão: é uma exceção.
    assert api.patch(url, {"versao": c["versao"], "valor_final": "9000"}, format="json").status_code == 400
    r = api.post(reverse("comissao-pedir-excecao", args=[c["id"]]), {"valor_proposto": "9000", "motivo": "Desconto"},
                 format="json")  # fmt: skip
    assert r.status_code == 201
    e = r.json()["excecoes"][0]
    assert e["estado"] == "pendente" and r.json()["valor_final"] == "10000.00"  # ainda não está em vigor
    decidir = reverse("comissao-decidir-excecao", args=[c["id"], e["id"]])
    assert api.post(decidir, {"aprovar": True}, format="json").status_code == 403  # autoaprovação
    api.force_authenticate(pessoas.resp)
    assert api.post(decidir, {"aprovar": True}, format="json").status_code == 403  # é beneficiário
    api.force_authenticate(pessoas.ana)
    assert api.post(decidir, {"aprovar": True}, format="json").status_code == 403  # consultor não aprova
    api.force_authenticate(pessoas.admin2)
    r = api.post(decidir, {"aprovar": True, "motivo": "Acordado com o cliente"}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["valor_final"] == "9000.00" and d["valor_calculado"] == "10000.00" and d["origem"] == "excecao"
    assert d["excecoes"][0]["decidido_por_nome"] == pessoas.admin2.nome
    assert api.post(decidir, {"aprovar": False, "motivo": "x"}, format="json").status_code == 400  # já decidida
    assert Comissao.objects.get(pk=c["id"]).historico.count() >= 2


def test_consultor_ve_as_comissoes_dos_seus_negocios_mas_nao_apura(api, pessoas):
    t = transacao(pessoas, consultor_imovel=pessoas.ana, consultor_comprador=None)
    api.force_authenticate(pessoas.ana)
    assert apurar(api, t).status_code == 403
    api.force_authenticate(pessoas.admin)
    c = apurar(api, t).json()
    api.force_authenticate(pessoas.ana)
    assert api.get(reverse("comissao-detail", args=[c["id"]])).status_code == 200
    assert api.get(reverse("transacao-detail", args=[t.pk])).json()["comissao"]["referencia"] == c["referencia"]
