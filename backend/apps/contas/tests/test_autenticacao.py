import re

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from conftest import PASSWORD

pytestmark = pytest.mark.django_db


def entrar(api, email, password=PASSWORD):
    return api.post(reverse("auth-entrar"), {"email": email, "password": password}, format="json")


def test_sem_sessao_nao_acede_ao_utilizador_atual(api):
    assert api.get(reverse("auth-eu")).status_code == 401


def test_entrar_com_credenciais_corretas(api, criar_utilizador):
    u = criar_utilizador(Perfil.CONSULTOR, email="ana@exemplo.pt")
    r = entrar(api, "ANA@exemplo.pt ")
    assert r.status_code == 200, r.content
    assert r.json()["email"] == "ana@exemplo.pt"
    assert r.json()["permissoes"]["imoveis"]["consultar"] == "atribuidos"
    assert api.get(reverse("auth-eu")).json()["id"] == u.id
    assert RegistoAuditoria.objects.filter(acao="sessao.entrada", utilizador=u).exists()


def test_credenciais_erradas_mensagem_generica_e_auditada(api, criar_utilizador):
    criar_utilizador(email="ana@exemplo.pt")
    errada = entrar(api, "ana@exemplo.pt", "errada")
    inexistente = entrar(api, "ninguem@exemplo.pt")
    assert errada.status_code == inexistente.status_code == 400
    assert errada.json() == inexistente.json()
    assert RegistoAuditoria.objects.filter(acao="sessao.falha").count() == 2


def test_utilizador_inativo_nao_entra(api, criar_utilizador):
    criar_utilizador(email="ana@exemplo.pt", is_active=False)
    assert entrar(api, "ana@exemplo.pt").status_code == 400


def test_sair_termina_a_sessao(api, criar_utilizador):
    criar_utilizador(email="ana@exemplo.pt")
    entrar(api, "ana@exemplo.pt")
    assert api.post(reverse("auth-sair")).status_code == 204
    assert api.get(reverse("auth-eu")).status_code == 401


def test_entrar_exige_csrf(criar_utilizador):
    criar_utilizador(email="ana@exemplo.pt")
    cliente = APIClient(enforce_csrf_checks=True)
    sem_token = entrar(cliente, "ana@exemplo.pt")
    assert sem_token.status_code == 403
    cliente.get(reverse("auth-csrf"))
    token = cliente.cookies["csrftoken"].value
    r = cliente.post(
        reverse("auth-entrar"),
        {"email": "ana@exemplo.pt", "password": PASSWORD},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert r.status_code == 200


def test_limite_de_tentativas_de_entrada(api, monkeypatch, criar_utilizador):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "entrar", "3/min")
    for _ in range(3):
        assert entrar(api, "x@exemplo.pt", "errada").status_code == 400
    assert entrar(api, "x@exemplo.pt", "errada").status_code == 429


class TestRecuperacao:
    def test_pedido_para_email_existente_envia_mensagem(self, api, criar_utilizador, mailoutbox):
        criar_utilizador(email="ana@exemplo.pt")
        r = api.post(reverse("auth-recuperar"), {"email": "ana@exemplo.pt"}, format="json")
        assert r.status_code == 202
        assert len(mailoutbox) == 1
        assert "/recuperar/" in mailoutbox[0].body

    def test_pedido_para_email_inexistente_responde_igual(self, api, mailoutbox):
        r = api.post(reverse("auth-recuperar"), {"email": "ninguem@exemplo.pt"}, format="json")
        assert r.status_code == 202
        assert mailoutbox == []

    def test_definir_nova_password_com_token_valido(self, api, criar_utilizador, mailoutbox):
        criar_utilizador(email="ana@exemplo.pt")
        api.post(reverse("auth-recuperar"), {"email": "ana@exemplo.pt"}, format="json")
        uid, token = re.search(r"/recuperar/([^/]+)/([^/\s]+)", mailoutbox[0].body).groups()
        nova = "Outra-palavra-passe-segura-456"
        url = reverse("auth-recuperar-confirmar")
        r = api.post(url, {"uid": uid, "token": token, "nova_password": nova}, format="json")
        assert r.status_code == 204
        assert entrar(api, "ana@exemplo.pt", nova).status_code == 200
        # O token deixa de ser válido depois de usado.
        r2 = api.post(url, {"uid": uid, "token": token, "nova_password": nova + "x"}, format="json")
        assert r2.status_code == 400

    def test_token_invalido_e_recusado(self, api, criar_utilizador):
        criar_utilizador(email="ana@exemplo.pt")
        r = api.post(
            reverse("auth-recuperar-confirmar"),
            {"uid": "MQ", "token": "invalido", "nova_password": "Qualquer-coisa-segura-1"},
            format="json",
        )
        assert r.status_code == 400

    def test_password_fraca_e_recusada(self, api, criar_utilizador, mailoutbox):
        criar_utilizador(email="ana@exemplo.pt")
        api.post(reverse("auth-recuperar"), {"email": "ana@exemplo.pt"}, format="json")
        uid, token = re.search(r"/recuperar/([^/]+)/([^/\s]+)", mailoutbox[0].body).groups()
        r = api.post(
            reverse("auth-recuperar-confirmar"),
            {"uid": uid, "token": token, "nova_password": "123"},
            format="json",
        )
        assert r.status_code == 400
