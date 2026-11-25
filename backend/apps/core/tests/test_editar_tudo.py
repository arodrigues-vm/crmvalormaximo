"""D-42: tudo o que se cria pode ser editado, ficando o valor anterior na auditoria."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.angariacoes.models import Angariacao
from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade, TipoRelacao
from apps.imoveis.models import Imovel
from apps.oportunidades.models import Oportunidade

pytestmark = pytest.mark.django_db
HOJE = timezone.localdate()


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome).pk


@pytest.fixture
def u(criar_utilizador, api):
    u = criar_utilizador(Perfil.CONSULTOR)
    api.force_authenticate(u)
    return u


def test_editar_contacto_registado(api, u):
    o = Oportunidade.objects.create(entidade=Entidade.objects.create(nome="A", responsavel=u), responsavel=u)
    url = reverse("oportunidade-interacoes", args=[o.pk])
    lista = api.post(url, {"tipo": v("tipos_interacao", "Email"), "momento": "2026-11-20T10:00:00Z",
                           "resumo": "Enviei a avaliação"}, format="json").json()  # fmt: skip
    r = api.patch(reverse("oportunidade-editar-interacao", args=[o.pk, lista[0]["id"]]),
                  {"resumo": "Enviei a avaliação e o CMI"}, format="json")  # fmt: skip
    assert r.status_code == 200, r.content
    assert r.json()[0]["resumo"] == "Enviei a avaliação e o CMI" and r.json()[0]["editada_por"]
    aud = RegistoAuditoria.objects.get(acao="oportunidade.interacao_alterada")
    assert aud.dados["antes"]["resumo"] == "Enviei a avaliação"


def test_editar_ligacao(api, u):
    i = Imovel.objects.create(responsavel=u)
    url = reverse("imovel-ligacoes", args=[i.pk])
    lista = api.post(url, {"tipo": v("tipos_ligacao", "Fotografias"), "titulo": "Fotos",
                           "url": "https://exemplo.pt/a"}, format="json").json()  # fmt: skip
    r = api.patch(reverse("imovel-remover-ligacao", args=[i.pk, lista[0]["id"]]),
                  {"titulo": "Fotografias do imóvel", "url": "https://exemplo.pt/b"}, format="json")  # fmt: skip
    assert r.status_code == 200 and r.json()[0]["titulo"] == "Fotografias do imóvel"
    assert r.json()[0]["url"] == "https://exemplo.pt/b"


def test_editar_relacao(api, u):
    a = Entidade.objects.create(nome="Ana", responsavel=u)
    b = Entidade.objects.create(nome="Rui", responsavel=u)
    familiar = TipoRelacao.objects.get(nome="Familiar")
    conjuge = TipoRelacao.objects.get(nome="Cônjuge")
    rel = api.post(reverse("entidade-relacoes", args=[a.pk]), {"tipo": familiar.pk, "entidade": b.pk},
                   format="json").json()[0]  # fmt: skip
    r = api.patch(reverse("entidade-remover-relacao", args=[a.pk, rel["id"]]),
                  {"tipo": conjuge.pk, "observacoes": "Casados em 2010"}, format="json")  # fmt: skip
    assert r.status_code == 200, r.content
    assert r.json()[0]["rotulo"] == "Cônjuge" and r.json()[0]["observacoes"] == "Casados em 2010"


def test_editar_renovacao(api, u):
    i = Imovel.objects.create(responsavel=u)
    cmi = Angariacao.objects.create(imovel=i, responsavel=u, data_inicio=HOJE - timedelta(days=200), prazo_meses=6)
    cmi.recalcular_datas()
    cmi.save()
    inicio = cmi.data_fim + timedelta(days=1)
    corpo = {"forma": "documento", "data_inicio": str(inicio), "prazo_meses": 3}
    d = api.post(reverse("angariacao-renovar", args=[cmi.pk]), corpo, format="json").json()
    ren = d["renovacoes"][0]
    r = api.patch(reverse("angariacao-editar-renovacao", args=[cmi.pk, ren["id"]]), {"prazo_meses": 6}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["renovacoes"][0]["prazo_meses"] == 6
    assert r.json()["data_fim_vigente"] == r.json()["renovacoes"][0]["data_fim"]
    # Continua a não poder começar antes do fim do ciclo anterior.
    r = api.patch(reverse("angariacao-editar-renovacao", args=[cmi.pk, ren["id"]]),
                  {"data_inicio": str(cmi.data_fim)}, format="json")  # fmt: skip
    assert r.status_code == 400


def test_renomear_equipa(api, criar_utilizador):
    adm = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(adm)
    e = api.post(reverse("equipa-list"), {"nome": "Valor Maxmo"}, format="json").json()
    r = api.patch(reverse("equipa-detail", args=[e["id"]]), {"nome": "Valor Máximo"}, format="json")
    assert r.status_code == 200 and r.json()["nome"] == "Valor Máximo"
