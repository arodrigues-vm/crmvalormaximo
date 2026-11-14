import time

import pyotp
import pytest
from django.urls import reverse

from apps.contas.models import ConfiguracaoMFA, Perfil
from apps.core.models import RegistoAuditoria
from conftest import PASSWORD

pytestmark = pytest.mark.django_db


def entrar(api, email):
    return api.post(reverse("auth-entrar"), {"email": email, "password": PASSWORD}, format="json")


def codigo(segredo, desvio_passos=0):
    return pyotp.TOTP(segredo).at(time.time() + 30 * desvio_passos)


@pytest.fixture
def admin(criar_utilizador):
    return criar_utilizador(Perfil.ADMINISTRADOR, email="admin@exemplo.pt")


def configurar(api):
    r = api.post(reverse("auth-mfa-configurar"))
    assert r.status_code == 200, r.content
    segredo = r.json()["segredo"]
    assert r.json()["uri"].startswith("otpauth://totp/")
    r = api.post(reverse("auth-mfa-ativar"), {"codigo": codigo(segredo)}, format="json")
    assert r.status_code == 200, r.content
    return segredo, r.json()["codigos_recuperacao"]


class TestConfiguracaoObrigatoria:
    def test_administrador_sem_mfa_fica_bloqueado_ate_configurar(self, api, admin):
        assert entrar(api, admin.email).status_code == 200
        eu = api.get(reverse("auth-eu")).json()
        assert eu["mfa_configuracao_pendente"] is True
        bloqueado = api.get(reverse("schema"))
        assert bloqueado.status_code == 403
        assert bloqueado.json()["codigo"] == "mfa_configuracao_obrigatoria"
        assert api.get("/admin/").status_code == 403

        configurar(api)
        assert api.get(reverse("auth-eu")).json()["mfa_configuracao_pendente"] is False
        assert api.get(reverse("schema")).status_code == 200

    def test_consultor_nao_e_obrigado(self, api, criar_utilizador):
        u = criar_utilizador(Perfil.CONSULTOR)
        entrar(api, u.email)
        assert api.get(reverse("auth-eu")).json()["mfa_configuracao_pendente"] is False
        assert api.get(reverse("schema")).status_code == 200

    def test_codigo_errado_nao_ativa(self, api, admin):
        entrar(api, admin.email)
        api.post(reverse("auth-mfa-configurar"))
        r = api.post(reverse("auth-mfa-ativar"), {"codigo": "000000"}, format="json")
        assert r.status_code == 400
        assert ConfiguracaoMFA.objects.get(utilizador=admin).ativa is False

    def test_segredo_guardado_cifrado(self, api, admin):
        entrar(api, admin.email)
        segredo = api.post(reverse("auth-mfa-configurar")).json()["segredo"]
        assert segredo not in ConfiguracaoMFA.objects.get(utilizador=admin).segredo_cifrado

    def test_nao_reconfigura_mfa_ativa(self, api, admin):
        entrar(api, admin.email)
        configurar(api)
        assert api.post(reverse("auth-mfa-configurar")).status_code == 400


class TestEntradaComMfa:
    @pytest.fixture
    def segredo_e_codigos(self, api, admin):
        entrar(api, admin.email)
        resultado = configurar(api)
        api.post(reverse("auth-sair"))
        return resultado

    def test_palavra_passe_sozinha_nao_abre_sessao(self, api, admin, segredo_e_codigos):
        r = entrar(api, admin.email)
        assert r.status_code == 200
        assert r.json() == {"mfa_necessaria": True}
        assert api.get(reverse("auth-eu")).status_code == 401

    def test_codigo_correto_abre_sessao(self, api, admin, segredo_e_codigos):
        segredo, _ = segredo_e_codigos
        entrar(api, admin.email)
        r = api.post(reverse("auth-mfa-verificar"), {"codigo": codigo(segredo, 1)}, format="json")
        assert r.status_code == 200, r.content
        assert api.get(reverse("auth-eu")).json()["email"] == admin.email

    def test_codigo_nao_pode_ser_reutilizado(self, api, admin, segredo_e_codigos):
        segredo, _ = segredo_e_codigos
        c = codigo(segredo, 1)
        entrar(api, admin.email)
        assert api.post(reverse("auth-mfa-verificar"), {"codigo": c}, format="json").status_code == 200
        api.post(reverse("auth-sair"))
        entrar(api, admin.email)
        assert api.post(reverse("auth-mfa-verificar"), {"codigo": c}, format="json").status_code == 400

    def test_codigo_errado_e_auditado(self, api, admin, segredo_e_codigos):
        entrar(api, admin.email)
        r = api.post(reverse("auth-mfa-verificar"), {"codigo": "123456"}, format="json")
        assert r.status_code == 400
        assert api.get(reverse("auth-eu")).status_code == 401
        assert RegistoAuditoria.objects.filter(acao="sessao.mfa_falha", utilizador=admin).exists()

    def test_codigo_de_recuperacao_funciona_uma_vez(self, api, admin, segredo_e_codigos):
        _, codigos = segredo_e_codigos
        assert len(codigos) == 10
        entrar(api, admin.email)
        ok = api.post(reverse("auth-mfa-verificar"), {"codigo": codigos[0].lower()}, format="json")
        assert ok.status_code == 200
        api.post(reverse("auth-sair"))
        entrar(api, admin.email)
        repetido = api.post(reverse("auth-mfa-verificar"), {"codigo": codigos[0]}, format="json")
        assert repetido.status_code == 400

    def test_verificar_sem_palavra_passe_previa_e_recusado(self, api, admin, segredo_e_codigos):
        segredo, _ = segredo_e_codigos
        r = api.post(reverse("auth-mfa-verificar"), {"codigo": codigo(segredo, 1)}, format="json")
        assert r.status_code == 400
        assert api.get(reverse("auth-eu")).status_code == 401

    def test_tempo_expirado(self, api, admin, segredo_e_codigos, settings):
        segredo, _ = segredo_e_codigos
        settings.CRM_MFA_PENDENTE_SEGUNDOS = -1
        entrar(api, admin.email)
        r = api.post(reverse("auth-mfa-verificar"), {"codigo": codigo(segredo, 1)}, format="json")
        assert r.status_code == 400
        assert "expirou" in r.json()["detail"]
