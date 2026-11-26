"""Faturação dos consultores à agência e pagamentos (F3-08, AT-07, D-49)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.angariacoes.models import Angariacao
from apps.comissoes.tests.test_api import pessoas, transacao, v  # noqa: F401 — fixture e auxiliares
from apps.faturacao.models import Movimento

pytestmark = pytest.mark.django_db
HOJE = timezone.localdate()


@pytest.fixture
def comissao(api, pessoas):  # noqa: F811
    """Venda de 200.000 € a 5 %: Ana (angariação, 50 % do lado) = 2.500 €; Rui (venda, lado − 450 €) = 4.550 €.
    CMI com pagamento «50% no CPCV e 50% na escritura»."""
    t = transacao(pessoas, consultor_imovel=pessoas.ana, consultor_comprador=pessoas.rui)
    Angariacao.objects.filter(pk=t.angariacao_id).update(
        momento_pagamento=v("momentos_pagamento_comissao", "50% no CPCV e 50% na escritura")
    )
    api.force_authenticate(pessoas.admin)
    return api.post(reverse("comissao-list"), {"transacao": t.pk}, format="json").json()


def documento(api, c, consultor, **extra):
    corpo = {
        "comissao": c["id"],
        "consultor": consultor.pk,
        "tipo": v("tipos_documento_consultor", "Fatura").pk,
        "serie": "A",
        "numero": "1",
        "data_emissao": str(HOJE),
        "base": "1250.00",
        "taxa_iva": "23",
        **extra,
    }
    return api.post(reverse("documento-consultor-list"), corpo, format="json")


def test_prestacoes_propostas_pelo_momento_de_pagamento(api, pessoas, comissao):  # noqa: F811
    url = reverse("comissao-proposta-prestacoes", args=[comissao["id"]])
    proposta = api.get(url).json()
    assert [(p["utilizador_nome"], p["momento"], p["valor"]) for p in proposta] == [
        (pessoas.ana.nome, "cpcv", "1250.00"), (pessoas.ana.nome, "escritura", "1250.00"),
        (pessoas.rui.nome, "cpcv", "2275.00"), (pessoas.rui.nome, "escritura", "2275.00"),
    ]  # fmt: skip
    assert api.get(reverse("comissao-detail", args=[comissao["id"]])).json()["prestacoes"] == []  # nada gravado
    r = api.put(reverse("comissao-prestacoes", args=[comissao["id"]]), {"prestacoes": proposta}, format="json")
    assert r.status_code == 200 and len(r.json()["prestacoes"]) == 4


def test_documento_iva_duplicados_e_saldos(api, pessoas, comissao):  # noqa: F811
    r = documento(api, comissao, pessoas.ana, retencao="250.00")
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["iva"] == "287.50" and d["total"] == "1537.50"
    assert d["saldo"] == {"a_pagar": "1287.50", "pago": "0.00", "em_aberto": "1287.50", "estornos_pendentes": "0.00"}
    assert documento(api, comissao, pessoas.ana).status_code == 400  # duplicado (consultor, tipo, série, número)
    assert documento(api, comissao, pessoas.resp, numero="9").status_code == 400  # não recebe desta comissão
    resumo = api.get(reverse("comissao-detail", args=[comissao["id"]])).json()["pagamentos_consultores"]
    ana = next(x for x in resumo if x["utilizador"] == pessoas.ana.pk)
    assert ana == {"utilizador": pessoas.ana.pk, "utilizador_nome": pessoas.ana.nome, "a_receber": "2500.00",
                   "faturado": "1287.50", "pago": "0.00", "por_pagar": "1287.50"}  # fmt: skip


def test_pagamentos_parciais_e_excesso_recusado(api, pessoas, comissao):  # noqa: F811
    d = documento(api, comissao, pessoas.ana).json()
    url = reverse("documento-consultor-pagamento", args=[d["id"]])
    r = api.post(url, {"data_efetiva": str(HOJE), "valor": "1000", "meio": v("meios_pagamento", "Cheque").pk},
                 format="json")  # fmt: skip
    assert r.status_code == 201 and r.json()["saldo"]["em_aberto"] == "537.50"
    assert api.post(url, {"data_efetiva": str(HOJE), "valor": "600"}, format="json").status_code == 400  # excesso
    futuro = str(HOJE + timedelta(days=2))
    assert api.post(url, {"data_efetiva": futuro, "valor": "10"}, format="json").status_code == 400
    r = api.post(url, {"data_efetiva": str(HOJE), "valor": "537.50"}, format="json")
    assert r.json()["saldo"]["em_aberto"] == "0.00"
    # Com pagamentos, os valores ficam fixos e o documento não vai para a lixeira.
    detalhe = reverse("documento-consultor-detail", args=[d["id"]])
    assert api.patch(detalhe, {"versao": r.json()["versao"], "base": "1"}, format="json").status_code == 400
    assert api.delete(detalhe).status_code == 400


def test_estorno_com_aprovacao_independente(api, pessoas, comissao):  # noqa: F811
    d = documento(api, comissao, pessoas.rui).json()
    pag = api.post(reverse("documento-consultor-pagamento", args=[d["id"]]),
                   {"data_efetiva": str(HOJE), "valor": "1000"}, format="json").json()  # fmt: skip
    pagamento = pag["movimentos"][0]["id"]
    url = reverse("documento-consultor-estorno", args=[d["id"]])
    corpo = {"pagamento": pagamento, "valor": "300", "motivo": "Pago a mais", "data_efetiva": str(HOJE)}
    assert api.post(url, {**corpo, "valor": "1200"}, format="json").status_code == 400  # mais do que o pagamento
    r = api.post(url, corpo, format="json")
    assert r.status_code == 201
    estorno = next(m for m in r.json()["movimentos"] if m["tipo"] == "estorno")
    assert estorno["estado"] == "pendente" and r.json()["saldo"]["pago"] == "1000.00"  # ainda sem efeito
    # Estornos pendentes comprometem o saldo: não se pode pedir outro acima do que resta.
    assert api.post(url, {**corpo, "valor": "800"}, format="json").status_code == 400
    decidir = reverse("documento-consultor-decidir-estorno", args=[d["id"], estorno["id"]])
    assert api.post(decidir, {"aprovar": True}, format="json").status_code == 403  # quem pediu
    api.force_authenticate(pessoas.rui)
    assert api.post(decidir, {"aprovar": True}, format="json").status_code in (403, 404)  # o consultor não decide
    api.force_authenticate(pessoas.resp)
    r = api.post(decidir, {"aprovar": True}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["saldo"]["pago"] == "700.00"
    # O livro é imutável: o pagamento original continua lá, com o estorno ligado.
    assert Movimento.objects.filter(documento_id=d["id"]).count() == 2
    assert Movimento.objects.get(pk=pagamento).valor == Decimal("1000.00")


def test_nota_de_credito_reduz_o_faturado(api, pessoas, comissao):  # noqa: F811
    d = documento(api, comissao, pessoas.ana).json()
    credito = v("tipos_documento_consultor", "Nota de crédito").pk
    assert documento(api, comissao, pessoas.ana, tipo=credito, numero="NC1").status_code == 400  # falta o original
    r = documento(api, comissao, pessoas.ana, tipo=credito, numero="NC1", base="250", documento_original=d["id"])
    assert r.status_code == 201 and r.json()["saldo"]["a_pagar"] == "-307.50"
    resumo = api.get(reverse("comissao-detail", args=[comissao["id"]])).json()["pagamentos_consultores"]
    assert next(x for x in resumo if x["utilizador"] == pessoas.ana.pk)["faturado"] == "1230.00"


def test_consultor_ve_os_seus_documentos(api, pessoas, comissao):  # noqa: F811
    d = documento(api, comissao, pessoas.ana).json()
    api.force_authenticate(pessoas.ana)
    assert api.get(reverse("documento-consultor-detail", args=[d["id"]])).status_code == 200
    assert documento(api, comissao, pessoas.ana, numero="2").status_code == 403  # consultor não regista
    api.force_authenticate(pessoas.rui)
    assert api.get(reverse("documento-consultor-detail", args=[d["id"]])).status_code == 404
