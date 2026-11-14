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


def test_ip_atras_do_proxy(rf, settings):
    from apps.core.auditoria import _ip

    pedido = rf.get("/", HTTP_X_FORWARDED_FOR="1.1.1.1, 203.0.113.7", REMOTE_ADDR="172.18.0.3")
    settings.CRM_CONFIAR_PROXY = False
    assert _ip(pedido) == "172.18.0.3"
    settings.CRM_CONFIAR_PROXY = True
    assert _ip(pedido) == "203.0.113.7"
