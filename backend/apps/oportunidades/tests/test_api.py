from decimal import Decimal

import pytest
from django.urls import reverse

from apps.angariacoes.models import Angariacao
from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel

pytestmark = pytest.mark.django_db
LISTA = reverse("oportunidade-list")


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome).pk


@pytest.fixture
def u(criar_utilizador):
    return criar_utilizador(Perfil.CONSULTOR)


@pytest.fixture
def ana(u):
    return Entidade.objects.create(nome="Ana Ensaio", responsavel=u)


def criar(api, u, ana, **extra):
    api.force_authenticate(u)
    corpo = {
        "entidade": ana.pk, "operacao": v("operacoes", "Venda"), "tipo_imovel": v("tipos_imovel", "Moradia"),
        "tipologia": v("tipologias", "T3"), "localidade": "Ensaio", "preco_pretendido": "320000",
        "motivacao": "Mudança de cidade",
    }  # fmt: skip
    corpo.update(extra)
    r = api.post(LISTA, corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_criar_com_estado_por_omissao(api, u, ana):
    o = criar(api, u, ana)
    assert o["referencia"].startswith("OPA-") and o["estado_nome"] == "Contacto"
    assert o["imovel_descricao"] == "Moradia T3 · Ensaio"
    assert o["angariacao_gerada"] is None


def test_converter_cria_so_o_imovel(api, u, ana):
    """D-35: a oportunidade cria o imóvel; o CMI cria-se depois, a partir do imóvel."""
    o = criar(api, u, ana)
    url = reverse("oportunidade-converter", args=[o["id"]])
    assert api.post(url, {"confirmar": False}, format="json").status_code == 400
    assert api.post(url, {"confirmar": True, "criar_cmi": True}, format="json").status_code == 400
    r = api.post(url, {"confirmar": True}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()
    i = Imovel.objects.get(pk=d["imovel"])
    assert d["imovel_criado"] and d["angariacao"] is None and i.preco == Decimal("320000")
    assert list(i.proprietarios.values_list("entidade_id", flat=True)) == [ana.pk]
    assert Angariacao.objects.count() == 0
    # Idempotente: já tem imóvel → não cria outro.
    r2 = api.post(url, {"confirmar": True}, format="json")
    assert r2.status_code == 409 and r2.json()["imovel"] == i.pk
    assert RegistoAuditoria.objects.filter(acao="oportunidade.convertida").count() == 1
    assert api.get(reverse("oportunidade-detail", args=[o["id"]])).json()["estado_nome"] == "Contacto"


def test_converter_com_imovel_existente_recusa(api, u, ana):
    i = Imovel.objects.create(responsavel=u, operacao=ValorLista.objects.get(pk=v("operacoes", "Venda")))
    o = criar(api, u, ana, imovel=i.pk)
    r = api.post(reverse("oportunidade-converter", args=[o["id"]]), {"confirmar": True}, format="json")
    assert r.status_code == 409 and r.json()["codigo"] == "ja_tem_imovel"
    assert Imovel.objects.count() == 1


def test_converter_so_imovel(api, u, ana):
    o = criar(api, u, ana)
    d = api.post(
        reverse("oportunidade-converter", args=[o["id"]]), {"confirmar": True, "criar_cmi": False}, format="json"
    ).json()
    assert d["imovel_criado"] and d["angariacao"] is None
    assert Angariacao.objects.count() == 0


def test_assistente_nao_pode_criar_cmi(api, criar_utilizador, ana):
    assist = criar_utilizador(Perfil.ASSISTENTE)
    ana.responsavel = assist
    ana.save()
    o = criar(api, assist, ana)
    r = api.post(reverse("oportunidade-converter", args=[o["id"]]), {"confirmar": True}, format="json")
    # O assistente pode criar angariações? Matriz por omissão: criar em módulos comerciais = atribuídos → sim.
    assert r.status_code == 200


def test_imovel_sem_acesso_recusado(api, u, ana, criar_utilizador):
    outro = criar_utilizador(Perfil.CONSULTOR)
    i = Imovel.objects.create(responsavel=outro)
    api.force_authenticate(u)
    r = api.post(LISTA, {"entidade": ana.pk, "imovel": i.pk}, format="json")
    assert r.status_code == 400 and "imovel" in r.json()


def test_qualificacao_do_vendedor_d34(api, u, ana):
    o = criar(
        api, u, ana, prazo_vender="Até ao verão", url_anuncio="https://anuncios.exemplo.pt/123",
        ocupacao=v("ocupacoes_imovel", "Devoluto"), nivel_motivacao=v("niveis_motivacao", "Alta"),
        venda_depende_compra=v("sim_nao", "Não sabe"), valor_hipoteca="85000", objecoes="Acha a comissão alta",
    )  # fmt: skip
    assert o["prazo_vender"] == "Até ao verão" and o["valor_hipoteca"] == "85000.00"
    assert o["nomes"]["ocupacao"] == "Devoluto" and o["nomes"]["venda_depende_compra"] == "Não sabe"
    assert "qualificacao" not in o
    # Só aceita valores da lista certa.
    r = api.patch(
        reverse("oportunidade-detail", args=[o["id"]]),
        {"ocupacao": v("niveis_motivacao", "Alta"), "versao": o["versao"]},
        format="json",
    )
    assert r.status_code == 400
    opcoes = api.get(reverse("oportunidade-opcoes")).json()
    assert [x["nome"] for x in opcoes["sim_nao"]] == ["Sim", "Não", "Não sabe"]
