import pytest
from django.urls import reverse

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil

pytestmark = pytest.mark.django_db


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome).pk


def test_agencia_e_agente(api, criar_utilizador):
    resp = criar_utilizador(Perfil.RESPONSAVEL)
    api.force_authenticate(resp)
    r = api.post(
        reverse("agencia-list"),
        {"nome": "Agência Ensaio", "tipo": v("tipos_agencia", "Externa"), "licenca_ami": "12345",
         "telefone": "912 345 678"},
        format="json",
    )  # fmt: skip
    assert r.status_code == 201, r.content
    ag = r.json()
    assert ag["referencia"].startswith("AGC-") and ag["telefone_e164"] == "+351912345678"
    assert ag["status_nome"] == "Ativo" and ag["tipo_categoria"] == "externa"
    r = api.post(
        reverse("agente-list"),
        {"nome": "Rita Ensaio", "agencia": ag["id"], "tipo": v("tipos_agente", "Agente externo")},
        format="json",
    )
    assert r.status_code == 201, r.content
    assert r.json()["agencia_nome"] == "Agência Ensaio"
    # Pesquisa também pelo nome da agência.
    assert api.get(reverse("agente-list"), {"pesquisa": "agencia ensaio"}).json()["count"] == 1
    assert api.get(reverse("agencia-detail", args=[ag["id"]])).json()["n_agentes"] == 1


def test_telefone_invalido_e_utilizador_unico(api, criar_utilizador):
    adm = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(adm)
    r = api.post(reverse("agente-list"), {"nome": "X", "telefone": "123"}, format="json")
    assert r.status_code == 400 and "telefone" in str(r.json())
    assert api.post(reverse("agente-list"), {"nome": "A", "utilizador": adm.pk}, format="json").status_code == 201
    r = api.post(reverse("agente-list"), {"nome": "B", "utilizador": adm.pk}, format="json")
    assert r.status_code == 400 and "utilizador" in str(r.json())


def test_consultor_cria_e_edita_os_seus(api, criar_utilizador):
    """D-38: o Consultor regista agentes (ex.: o agente externo de uma visita) e edita os que criou."""
    cons = criar_utilizador(Perfil.CONSULTOR)
    outro = criar_utilizador(Perfil.CONSULTOR)
    api.force_authenticate(cons)
    r = api.post(reverse("agente-list"), {"nome": "Agente Externo Ensaio"}, format="json")
    assert r.status_code == 201, r.content
    a = r.json()
    assert api.patch(reverse("agente-detail", args=[a["id"]]), {"email": "a@exemplo.pt", "versao": a["versao"]},
                     format="json").status_code == 200  # fmt: skip
    api.force_authenticate(outro)
    assert api.get(reverse("agente-detail", args=[a["id"]])).status_code == 200  # todos consultam
    r = api.patch(reverse("agente-detail", args=[a["id"]]), {"email": "b@exemplo.pt", "versao": 2}, format="json")
    assert r.status_code in (403, 404)
