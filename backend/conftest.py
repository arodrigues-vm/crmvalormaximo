import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.contas.models import Equipa, Perfil, Utilizador

PASSWORD = "Palavra-passe-de-teste-123"


@pytest.fixture(autouse=True)
def _limpar_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def equipa_norte(db):
    return Equipa.objects.create(nome="Equipa Norte")


@pytest.fixture
def equipa_sul(db):
    return Equipa.objects.create(nome="Equipa Sul")


@pytest.fixture
def criar_utilizador(db):
    contador = {"n": 0}

    def _criar(perfil=Perfil.CONSULTOR, equipa=None, **extra):
        contador["n"] += 1
        return Utilizador.objects.create_user(
            email=extra.pop("email", f"pessoa{contador['n']}@exemplo.pt"),
            password=PASSWORD,
            nome=extra.pop("nome", f"Pessoa {contador['n']}"),
            perfil=perfil,
            equipa=equipa,
            **extra,
        )

    return _criar
