import pytest
from django.urls import reverse

from apps.contas.models import Perfil, Utilizador
from apps.core.models import RegistoAuditoria

pytestmark = pytest.mark.django_db
SENHA = "Senha-Ensaio-Longa-2026!"


def test_administrador_cria_e_altera_membro(api, criar_utilizador, equipa_norte):
    adm = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(adm)
    r = api.post(
        reverse("membro-list"),
        {"nome": "Rita Ensaio", "email": "Rita@Exemplo.pt", "perfil": "consultor", "equipa": equipa_norte.pk,
         "telefone": "912 345 678", "identificacao_profissional": "C-123", "password": SENHA},
        format="json",
    )  # fmt: skip
    assert r.status_code == 201, r.content
    m = r.json()
    assert m["email"] == "rita@exemplo.pt" and m["telefone_e164"] == "+351912345678" and m["ativo"] is True
    u = Utilizador.objects.get(pk=m["id"])
    assert u.check_password(SENHA) and "password" not in m
    r = api.patch(reverse("membro-detail", args=[u.pk]), {"perfil": "responsavel", "ativo": False}, format="json")
    assert r.status_code == 200 and r.json()["perfil"] == "responsavel" and r.json()["ativo"] is False
    assert RegistoAuditoria.objects.filter(acao="equipa.membro_alterado").exists()


def test_validacoes(api, criar_utilizador):
    adm = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(adm)
    url = reverse("membro-list")
    assert (
        api.post(url, {"nome": "X", "email": "x@exemplo.pt", "perfil": "consultor"}, format="json").status_code == 400
    )
    r = api.post(url, {"nome": "X", "email": "x@exemplo.pt", "perfil": "consultor", "password": "123"}, format="json")
    assert r.status_code == 400 and "password" in r.json()
    r = api.post(url, {"nome": "X", "email": adm.email, "perfil": "consultor", "password": SENHA}, format="json")
    assert r.status_code == 400 and "email" in r.json()
    # Não se tira o acesso a si próprio.
    r = api.patch(reverse("membro-detail", args=[adm.pk]), {"ativo": False}, format="json")
    assert r.status_code == 400
    r = api.patch(reverse("membro-detail", args=[adm.pk]), {"perfil": "consultor"}, format="json")
    assert r.status_code == 400


def test_so_administrador_gere_mas_todos_consultam(api, criar_utilizador):
    cons = criar_utilizador(Perfil.CONSULTOR)
    resp = criar_utilizador(Perfil.RESPONSAVEL)
    for u in (cons, resp):
        api.force_authenticate(u)
        assert api.get(reverse("membro-list")).status_code == 200
        dados = {"nome": "X", "email": "y@exemplo.pt", "perfil": "consultor", "password": SENHA}
        assert api.post(reverse("membro-list"), dados, format="json").status_code == 403
        assert api.patch(reverse("membro-detail", args=[cons.pk]), {"nome": "Z"}, format="json").status_code == 403


def test_responsaveis_respeitam_ambito_de_transferencia(api, criar_utilizador, equipa_norte, equipa_sul):
    adm = criar_utilizador(Perfil.ADMINISTRADOR)
    resp = criar_utilizador(Perfil.RESPONSAVEL, equipa_norte)
    cons = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
    sul = criar_utilizador(Perfil.CONSULTOR, equipa_sul)
    url = reverse("responsaveis")

    def ids(u):
        api.force_authenticate(u)
        return {x["id"] for x in api.get(url, {"modulo": "imoveis"}).json()}

    assert ids(cons) == {cons.pk}
    assert ids(resp) == {resp.pk, cons.pk}
    assert {adm.pk, resp.pk, cons.pk, sul.pk} <= ids(adm)


def test_equipas(api, criar_utilizador):
    adm = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(adm)
    r = api.post(reverse("equipa-list"), {"nome": "Equipa Centro"}, format="json")
    assert r.status_code == 201 and r.json()["n_membros"] == 0
