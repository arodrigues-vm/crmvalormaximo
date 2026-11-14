import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_saude_responde_ok_sem_autenticacao(client):
    resposta = client.get(reverse("saude"))
    assert resposta.status_code == 200
    dados = resposta.json()
    assert dados["estado"] == "ok"
    assert dados["base_dados"] == "ok"


@pytest.mark.django_db
def test_schema_exige_autenticacao(client):
    # A descrição da API não é pública: revela a estrutura de dados.
    resposta = client.get(reverse("schema"))
    assert resposta.status_code == 401


def test_base_dados_e_postgresql(settings):
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"


def test_fuso_horario_lisboa(settings):
    assert settings.TIME_ZONE == "Europe/Lisbon"
    assert settings.USE_TZ is True
