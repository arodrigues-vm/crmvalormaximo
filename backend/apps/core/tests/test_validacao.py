import pytest
from django.core.exceptions import ValidationError

from apps.core.validacao import nif_valido, normalizar_telefone, paises_telefone


@pytest.mark.parametrize("nif", ["123456789", "501442600", "999999990"])
def test_nif_valido(nif):
    assert nif_valido(nif)


@pytest.mark.parametrize("nif", ["123456780", "12345678", "1234567890", "abcdefghi", ""])
def test_nif_invalido(nif):
    assert not nif_valido(nif)


def test_telefone_portugues_normalizado():
    assert normalizar_telefone("PT", "912 345 678") == "+351912345678"
    assert normalizar_telefone("pt", "+351 212 345 678") == "+351212345678"


def test_telefone_estrangeiro():
    assert normalizar_telefone("FR", "06 12 34 56 78") == "+33612345678"


@pytest.mark.parametrize("numero", ["123", "abc", "9123456789999"])
def test_telefone_invalido(numero):
    with pytest.raises(ValidationError):
        normalizar_telefone("PT", numero)


def test_lista_de_paises_inclui_portugal():
    assert {"regiao": "PT", "indicativo": "+351"} in paises_telefone()
