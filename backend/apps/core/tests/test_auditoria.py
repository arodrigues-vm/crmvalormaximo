import pytest

from apps.core.auditoria import registar

pytestmark = pytest.mark.django_db


def test_registo_de_auditoria_e_imutavel(criar_utilizador):
    r = registar("ensaio", utilizador=criar_utilizador(), descricao="original")
    r.descricao = "alterado"
    with pytest.raises(RuntimeError):
        r.save()
    with pytest.raises(RuntimeError):
        r.delete()
