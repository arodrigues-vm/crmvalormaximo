import pytest
from django.urls import reverse

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade

pytestmark = pytest.mark.django_db


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome).pk


def test_crud_basico_estado_por_omissao_e_interacoes(api, criar_utilizador):
    u = criar_utilizador(Perfil.CONSULTOR)
    outro = criar_utilizador(Perfil.CONSULTOR)
    e = Entidade.objects.create(nome="Comprador", responsavel=u)
    api.force_authenticate(u)
    r = api.post(
        reverse("procura-list"),
        {
            "entidade": e.pk,
            "operacao": v("operacoes", "Venda"),
            "orcamento_max": "250000",
            "tolerancia_pct": "20",
            "tipologias": [v("tipologias", "T2"), v("tipologias", "T3")],
            "imp_tipologias": "obrigatorio",
        },  # fmt: skip
        format="json",
    )
    assert r.status_code == 201, r.content
    p = r.json()
    assert p["referencia"].startswith("PRC-") and p["estado_nome"] == "Ativa" and p["teto"] == "300000.00"
    assert p["nomes"]["tipologias"] == ["T2", "T3"] and p["pretende_nome"] == "Comprar"
    # Entidade de outro consultor não pode ser usada.
    alheia = Entidade.objects.create(nome="Alheia", responsavel=outro)
    r2 = api.post(reverse("procura-list"), {"entidade": alheia.pk, "pretende": "comprar"}, format="json")
    assert r2.status_code == 400
    # Interações
    url = reverse("procura-interacoes", args=[p["id"]])
    ok = api.post(url, {"tipo": v("tipos_interacao", "Chamada telefónica"), "momento": "2026-11-15T10:00:00Z",
                        "resumo": "Confirmou orçamento"}, format="json")  # fmt: skip
    assert ok.status_code == 201 and ok.json()[0]["resumo"] == "Confirmou orçamento"
    anular = api.post(reverse("procura-anular-interacao", args=[p["id"], ok.json()[0]["id"]]))
    assert anular.json()[0]["anulada"] is True
    assert RegistoAuditoria.objects.filter(acao="procura.interacao_anulada").exists()
    # Sem acesso
    api.force_authenticate(outro)
    assert api.get(reverse("procura-detail", args=[p["id"]])).status_code == 404
