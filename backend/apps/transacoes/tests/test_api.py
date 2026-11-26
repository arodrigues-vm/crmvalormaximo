"""Transações (F3-05/F3-06, AT-09, AT-11, D-47)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.angariacoes.models import Angariacao
from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel, Proprietario
from apps.propostas.models import Participante, Proposta, Ronda
from apps.transacoes.models import Transacao

pytestmark = pytest.mark.django_db
HOJE = timezone.localdate()


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


def estado(nome):
    return v("estados_transacao", nome).pk


@pytest.fixture
def u(criar_utilizador, equipa_norte):
    return criar_utilizador(Perfil.CONSULTOR, equipa_norte)


@pytest.fixture
def cenario(u):
    comprador = Entidade.objects.create(nome="Bruno Comprador", responsavel=u)
    dona = Entidade.objects.create(nome="Ana Proprietária", responsavel=u)
    imovel = Imovel.objects.create(
        responsavel=u, localidade="Maia", preco=Decimal("250000"), operacao=v("operacoes", "Venda"),
        estado_comercializacao=v("estados_comercializacao", "Disponível"),
    )  # fmt: skip
    Proprietario.objects.create(imovel=imovel, entidade=dona, quota=100)
    cmi = Angariacao.objects.create(imovel=imovel, responsavel=u, operacao=v("operacoes", "Venda"))
    proposta = Proposta.objects.create(
        imovel=imovel, entidade=comprador, responsavel=u, consultor_comprador=u, consultor_imovel=u,
        estado=v("estados_proposta", "Aceite"),
    )  # fmt: skip
    Participante.objects.create(proposta=proposta, entidade=comprador, papel=v("papeis_participante", "Comprador"))
    Participante.objects.create(
        proposta=proposta, entidade=dona, papel=v("papeis_participante", "Proprietário"), quota=100, ordem=1
    )
    Ronda.objects.create(
        proposta=proposta, numero=1, autor="comprador", data=HOJE, valor=Decimal("235000"),
        sinal_valor=Decimal("10"), sinal_unidade="percentagem", data_cpcv=HOJE + timedelta(days=20),
        data_escritura=HOJE + timedelta(days=80),
    )  # fmt: skip

    class C:
        pass

    C.comprador, C.dona, C.imovel, C.cmi, C.proposta = comprador, dona, imovel, cmi, proposta
    return C


def gerar(api, c, **extra):
    corpo = {"proposta": c.proposta.pk, "angariacao": c.cmi.pk, "valor": "235000", **extra}
    return api.post(reverse("transacao-list"), corpo, format="json")


def mudar(api, t, nome, **extra):
    return api.post(reverse("transacao-mudar-estado", args=[t["id"]]), {"estado": estado(nome), **extra}, format="json")


def test_previa_so_de_proposta_aceite_e_sem_gravar(api, u, cenario):
    api.force_authenticate(u)
    url = reverse("transacao-previa")
    cenario.proposta.estado = v("estados_proposta", "Em negociação")
    cenario.proposta.save()
    r = api.get(url, {"proposta": cenario.proposta.pk})
    assert r.status_code == 409 and r.json()["codigo"] == "nao_aceite"
    cenario.proposta.estado = v("estados_proposta", "Aceite")
    cenario.proposta.save()
    d = api.get(url, {"proposta": cenario.proposta.pk}).json()
    assert d["valor"] == "235000.00" and d["sinal_unidade"] == "percentagem"
    assert d["cmi_sugerido"] == cenario.cmi.pk and len(d["cmis"]) == 1
    assert [p["nome"] for p in d["participantes"]] == ["Bruno Comprador", "Ana Proprietária"]
    assert Transacao.objects.count() == 0


def test_gerar_exige_cmi_expresso_e_nao_duplica(api, u, cenario):
    api.force_authenticate(u)
    r = api.post(reverse("transacao-list"), {"proposta": cenario.proposta.pk, "valor": "1"}, format="json")
    assert r.status_code == 400 and "angariacao" in r.json()  # o imóvel tem CMI: escolha expressa
    outro = Angariacao.objects.create(imovel=Imovel.objects.create(responsavel=u), responsavel=u)
    assert gerar(api, cenario, angariacao=outro.pk).status_code == 400  # CMI de outro imóvel
    r = gerar(api, cenario)
    assert r.status_code == 201, r.content
    t = r.json()
    assert t["referencia"].startswith("TRA-") and t["estado_nome"] == "Em preparação"
    assert t["imovel"] == cenario.imovel.pk and t["entidade"] == cenario.comprador.pk
    assert t["operacao_categoria"] == "venda" and t["responsavel_imovel_nome"] == u.nome
    assert [p["nome"] for p in t["participantes_detalhe"]] == ["Bruno Comprador", "Ana Proprietária"]
    assert gerar(api, cenario).status_code == 400
    previa = api.get(reverse("transacao-previa"), {"proposta": cenario.proposta.pk})
    assert previa.status_code == 409 and previa.json()["transacao"] == t["id"]
    assert RegistoAuditoria.objects.filter(acao="transacao.criado").exists()


def test_participantes_historicos_estaveis(api, u, cenario):
    """AT-11: mudanças posteriores na proposta ou no imóvel não reescrevem a transação."""
    api.force_authenticate(u)
    t = gerar(api, cenario).json()
    Participante.objects.filter(proposta=cenario.proposta, entidade=cenario.dona).delete()
    Proprietario.objects.filter(imovel=cenario.imovel).delete()
    r = api.get(reverse("transacao-detail", args=[t["id"]]))
    assert [p["nome"] for p in r.json()["participantes_detalhe"]] == ["Bruno Comprador", "Ana Proprietária"]


def test_estados_e_efeitos_confirmaveis(api, u, cenario):
    api.force_authenticate(u)
    t = gerar(api, cenario).json()
    assert mudar(api, t, "CPCV assinado").status_code == 400  # falta a data do CPCV
    assert mudar(api, t, "CPCV assinado", data_cpcv=str(HOJE + timedelta(days=1))).status_code == 400  # futuro
    r = mudar(api, t, "CPCV assinado", data_cpcv=str(HOJE))
    assert r.status_code == 200 and r.json()["estado_nome"] == "CPCV assinado"
    assert mudar(api, t, "Concluída").status_code == 400  # falta a data da escritura
    efeitos = api.get(reverse("transacao-efeitos", args=[t["id"]]), {"estado": estado("Concluída")}).json()
    assert {e["chave"] for e in efeitos} == {"imovel_estado", "cmi_concluir"}
    # Só se aplica o que foi confirmado: o CMI fica como estava.
    r = mudar(api, t, "Concluída", data_escritura=str(HOJE), efeitos=["imovel_estado"])
    assert r.status_code == 200, r.content
    cenario.imovel.refresh_from_db()
    cenario.cmi.refresh_from_db()
    assert cenario.imovel.estado_comercializacao.nome == "Vendido"
    assert cenario.cmi.situacao == Angariacao.Situacao.EM_CURSO
    assert api.delete(reverse("transacao-detail", args=[t["id"]])).status_code == 400  # concluída
    # Reabrir: exige motivo e propõe desfazer o que foi aplicado.
    assert mudar(api, t, "Em preparação").status_code == 400
    efeitos = api.get(reverse("transacao-efeitos", args=[t["id"]]), {"estado": estado("Em preparação")}).json()
    assert [e["chave"] for e in efeitos] == ["desfazer_imovel_estado"]
    r = mudar(api, t, "Em preparação", motivo="Escritura anulada", efeitos=["desfazer_imovel_estado"])
    assert r.status_code == 200
    cenario.imovel.refresh_from_db()
    assert cenario.imovel.estado_comercializacao.nome == "Disponível"
    assert r.json()["efeitos_aplicados"][0]["revertido"] is True
    assert mudar(api, t, "Cancelada").status_code == 400  # motivo obrigatório
    assert mudar(api, t, "Cancelada", motivo="Desistência").json()["estado_nome"] == "Cancelada"


def test_arrendamento_sem_cpcv_e_imovel_nao_registado_sem_cmi(api, u, cenario):
    api.force_authenticate(u)
    externa = Proposta.objects.create(
        imovel_descricao="Moradia T4", entidade=cenario.comprador, responsavel=u,
        estado=v("estados_proposta", "Aceite"),
    )  # fmt: skip
    r = api.post(reverse("transacao-list"), {"proposta": externa.pk, "valor": "900"}, format="json")
    assert r.status_code == 400 and "operacao" in r.json()
    arrendamento = v("operacoes", "Arrendamento").pk
    r = api.post(
        reverse("transacao-list"), {"proposta": externa.pk, "valor": "900", "operacao": arrendamento}, format="json"
    )
    assert r.status_code == 201, r.content
    t = r.json()
    assert t["angariacao"] is None and t["imovel_descricao_completa"] == "Moradia T4"
    assert mudar(api, t, "CPCV assinado", data_cpcv=str(HOJE)).status_code == 400
    assert mudar(api, t, "Concluída", data_escritura=str(HOJE)).status_code == 200


def test_sem_acesso_a_proposta(api, u, cenario, criar_utilizador, equipa_sul):
    outro = criar_utilizador(Perfil.CONSULTOR, equipa_sul)
    api.force_authenticate(outro)
    assert api.get(reverse("transacao-previa"), {"proposta": cenario.proposta.pk}).status_code == 404
    assert gerar(api, cenario).status_code == 400
