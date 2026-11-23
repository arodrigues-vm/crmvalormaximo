from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel
from apps.visitas.models import Interesse, Visita

pytestmark = pytest.mark.django_db
HOJE = timezone.localdate()


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome).pk


@pytest.fixture
def u(criar_utilizador):
    return criar_utilizador(Perfil.CONSULTOR)


@pytest.fixture
def cliente(u):
    return Entidade.objects.create(nome="Bruno Ensaio", responsavel=u)


@pytest.fixture
def imovel(u):
    return Imovel.objects.create(responsavel=u, localidade="Maia")


def criar(api, u, cliente, imovel, **extra):
    api.force_authenticate(u)
    corpo = {
        "entidade": cliente.pk,
        "imovel": imovel.pk,
        "data": str(HOJE + timedelta(days=2)),
        "hora_entrada": "10:00",
    }
    corpo.update(extra)
    r = api.post(reverse("visita-list"), corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_criar_visita_agendada_cria_interesse(api, u, cliente, imovel):
    vis = criar(api, u, cliente, imovel)
    assert vis["referencia"].startswith("VIS-") and vis["estado_nome"] == "Agendada"
    i = Interesse.objects.get(entidade=cliente, imovel=imovel)
    assert i.origem.nome == "Visita" and i.estado.nome == "Ativo" and i.ultima_visita is None
    # Segunda visita ao mesmo imóvel não duplica o interesse.
    criar(api, u, cliente, imovel)
    assert Interesse.objects.filter(entidade=cliente, imovel=imovel).count() == 1
    assert RegistoAuditoria.objects.filter(acao="interesse.criado").count() == 1


def test_realizada_com_avaliacao_atualiza_ultima_visita(api, u, cliente, imovel):
    vis = criar(api, u, cliente, imovel, data=str(HOJE))
    r = api.patch(
        reverse("visita-detail", args=[vis["id"]]),
        {
            "estado": v("estados_visita", "Realizada"), "hora_saida": "10:40", "versao": vis["versao"],
            "av_localizacao": v("avaliacoes_visita", "Muito bom"), "av_preco": v("avaliacoes_visita", "Mau"),
            "mais_gostou": "Vista", "menos_gostou": "Preço", "compraria": v("sim_nao", "Não sabe"),
        },
        format="json",
    )  # fmt: skip
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["nomes"]["av_localizacao"] == "Muito bom" and d["nomes"]["compraria"] == "Não sabe"
    assert Interesse.objects.get(entidade=cliente, imovel=imovel).ultima_visita == HOJE


def test_validacoes(api, u, cliente, imovel):
    api.force_authenticate(u)
    url = reverse("visita-list")
    base = {"entidade": cliente.pk, "imovel": imovel.pk, "data": str(HOJE + timedelta(days=3))}
    r = api.post(url, {**base, "estado": v("estados_visita", "Realizada")}, format="json")
    assert r.status_code == 400 and "estado" in str(r.json())
    r = api.post(url, {**base, "hora_entrada": "11:00", "hora_saida": "10:00"}, format="json")
    assert r.status_code == 400 and "hora_saida" in str(r.json())


def test_cancelada_nao_cria_interesse(api, u, cliente, imovel):
    criar(api, u, cliente, imovel, estado=v("estados_visita", "Cancelada"))
    assert not Interesse.objects.exists()


def test_acesso(api, u, cliente, imovel, criar_utilizador):
    outro = criar_utilizador(Perfil.CONSULTOR)
    vis = criar(api, u, cliente, imovel)
    api.force_authenticate(outro)
    assert api.get(reverse("visita-detail", args=[vis["id"]])).status_code == 404
    # Não pode marcar visitas para clientes/imóveis a que não tem acesso.
    r = api.post(
        reverse("visita-list"), {"entidade": cliente.pk, "imovel": imovel.pk, "data": str(HOJE)}, format="json"
    )
    assert r.status_code == 400


def test_interesse_manual_unico(api, u, cliente, imovel):
    api.force_authenticate(u)
    url = reverse("interesse-list")
    r = api.post(url, {"entidade": cliente.pk, "imovel": imovel.pk, "grau": v("graus_interesse", "Alto"),
                       "origem": v("origens_interesse", "Contacto telefónico")}, format="json")  # fmt: skip
    assert r.status_code == 201, r.content
    assert r.json()["referencia"].startswith("INT-") and r.json()["estado_nome"] == "Ativo"
    r2 = api.post(url, {"entidade": cliente.pk, "imovel": imovel.pk}, format="json")
    assert r2.status_code == 400
    # A visita seguinte reaproveita o interesse existente.
    criar(api, u, cliente, imovel)
    assert Interesse.objects.count() == 1 and Visita.objects.count() == 1
    filtrado = api.get(reverse("interesse-list"), {"imovel": imovel.pk}).json()
    assert filtrado["count"] == 1
