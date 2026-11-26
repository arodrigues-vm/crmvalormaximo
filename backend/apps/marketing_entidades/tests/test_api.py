"""Marketing de Entidades (F4-05, Cap. 20, D-04, D-55)."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.entidades.models import Entidade
from apps.marketing_entidades.models import Inscricao, PlanoEntidades
from apps.tarefas.models import Tarefa

pytestmark = pytest.mark.django_db
HOJE = timezone.localdate()
C = Entidade.Consentimento


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


@pytest.fixture
def u(criar_utilizador, equipa_norte):
    return criar_utilizador(Perfil.CONSULTOR, equipa_norte)


@pytest.fixture
def admin(criar_utilizador):
    return criar_utilizador(Perfil.ADMINISTRADOR)


def criar_plano(api, admin, **extra):
    api.force_authenticate(admin)
    corpo = {
        "nome": "Acompanhamento de compradores", "fundamento": "consentimento", "gatilhos": [],
        "passos": [
            {"nome": "Ligar ao cliente", "dias": 2, "periodicidade_dias": 90},
            {"nome": "Enviar novidades", "dias": 7},
        ],
        **extra,
    }  # fmt: skip
    r = api.post(reverse("plano-entidades-list"), corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_nasce_sem_planos():
    """D-04 / F4-05: o sistema nasce sem planos, campanhas ou tarefas de entidades."""
    assert PlanoEntidades.objects.count() == 0


def test_so_o_administrador_configura(api, u, admin):
    api.force_authenticate(u)
    r = api.post(reverse("plano-entidades-list"), {"nome": "X", "fundamento": "consentimento"}, format="json")
    assert r.status_code == 403
    p = criar_plano(api, admin, criterios={"papeis": [v("papeis_entidade", "Comprador").pk]})
    assert [x["nome"] for x in p["passos"]] == ["Ligar ao cliente", "Enviar novidades"]
    r = api.patch(reverse("plano-entidades-detail", args=[p["id"]]), {"criterios": {"papeis": [999999]}}, format="json")
    assert r.status_code == 400
    r = api.patch(reverse("plano-entidades-detail", args=[p["id"]]), {"gatilhos": ["inventado"]}, format="json")
    assert r.status_code == 400
    # Editar as tarefas do plano: as que saem ficam desativadas (não se apagam).
    passos = [{"id": p["passos"][0]["id"], "nome": "Ligar ao cliente (novo texto)", "dias": 3}]
    r = api.patch(reverse("plano-entidades-detail", args=[p["id"]]), {"passos": passos}, format="json")
    assert [(x["nome"], x["ativo"]) for x in r.json()["passos"]] == [
        ("Ligar ao cliente (novo texto)", True),
        ("Enviar novidades", False),
    ]


def test_rgpd_manual_e_tarefas(api, u, admin):
    p = criar_plano(api, admin)
    sem = Entidade.objects.create(nome="Sem Consentimento", responsavel=u)
    com = Entidade.objects.create(nome="Com Consentimento", responsavel=u, consentimento_marketing=C.CONCEDIDO)
    api.force_authenticate(u)
    url = reverse("inscricao-marketing-list")
    r = api.post(url, {"entidade": sem.pk, "plano": p["id"]}, format="json")
    assert r.status_code == 400 and "consentimento" in str(r.json()["plano"])
    r = api.post(url, {"entidade": com.pk, "plano": p["id"]}, format="json")
    assert r.status_code == 201, r.content
    ins = r.json()
    assert ins["referencia"].startswith("MKE-") and ins["progresso"] == {"total": 2, "concluidas": 0, "por_fazer": 2}
    assert api.post(url, {"entidade": com.pk, "plano": p["id"]}, format="json").status_code == 400  # já inscrita
    ligar = Tarefa.objects.get(inscricao_id=ins["id"], titulo="Ligar ao cliente")
    assert ligar.prazo == HOJE + timedelta(days=2) and ligar.responsavel == u
    assert (ligar.origem_modulo, ligar.origem_id) == ("entidades", com.pk)
    # A mesma tarefa no menu Tarefas e na ficha da entidade.
    ids = [
        x["id"]
        for x in api.get(reverse("tarefa-list"), {"origem_modulo": "entidades", "origem_id": com.pk}).json()["results"]
    ]
    assert ligar.pk in ids
    # Repetição: concluir cria a seguinte (90 dias depois).
    r = api.post(
        reverse("tarefa-mudar-estado", args=[ligar.pk]), {"estado": v("estados_tarefa", "Concluída").pk}, format="json"
    )
    assert r.status_code == 200
    seguinte = Tarefa.objects.filter(inscricao_id=ins["id"], titulo="Ligar ao cliente").exclude(pk=ligar.pk).get()
    assert seguinte.prazo == HOJE + timedelta(days=90)


def test_oposicao_termina_inscricao(api, u, admin, django_capture_on_commit_callbacks):
    p = criar_plano(api, admin, fundamento="interesse_legitimo")
    e = Entidade.objects.create(nome="Cliente", responsavel=u)  # consentimento desconhecido: chega o interesse legítimo
    api.force_authenticate(u)
    ins = api.post(reverse("inscricao-marketing-list"), {"entidade": e.pk, "plano": p["id"]}, format="json").json()
    with django_capture_on_commit_callbacks(execute=True):
        e.oposicao_marketing = True
        e.save()
    i = Inscricao.objects.get(pk=ins["id"])
    assert i.estado == "terminada" and "opôs" in i.motivo_fim
    assert {t.estado.categoria for t in i.tarefas.all()} == {"cancelada"}


def test_terminar_com_motivo(api, u, admin):
    p = criar_plano(api, admin, fundamento="interesse_legitimo")
    e = Entidade.objects.create(nome="Cliente", responsavel=u)
    api.force_authenticate(u)
    ins = api.post(reverse("inscricao-marketing-list"), {"entidade": e.pk, "plano": p["id"]}, format="json").json()
    url = reverse("inscricao-marketing-terminar", args=[ins["id"]])
    assert api.post(url, {}, format="json").status_code == 400
    r = api.post(url, {"motivo": "Cliente comprou casa"}, format="json")
    assert r.status_code == 200 and r.json()["estado"] == "terminada" and r.json()["progresso"]["por_fazer"] == 0
    assert api.delete(reverse("inscricao-marketing-detail", args=[ins["id"]])).status_code == 400


def test_gatilhos_so_quando_ligados(api, u, admin, django_capture_on_commit_callbacks):
    comprador = v("papeis_entidade", "Comprador")
    p = criar_plano(api, admin, fundamento="interesse_legitimo", criterios={"papeis": [comprador.pk]})
    with django_capture_on_commit_callbacks(execute=True):
        Entidade.objects.create(nome="Antes", responsavel=u)
    assert Inscricao.objects.count() == 0  # gatilho desligado
    api.patch(reverse("plano-entidades-detail", args=[p["id"]]), {"gatilhos": ["entidade_criada"]}, format="json")
    api.force_authenticate(u)
    with django_capture_on_commit_callbacks(execute=True):
        r = api.post(reverse("entidade-list"), {"nome": "Bruno", "papeis": [comprador.pk]}, format="json")
    assert r.status_code == 201, r.content
    with django_capture_on_commit_callbacks(execute=True):
        api.post(reverse("entidade-list"), {"nome": "Sem papel"}, format="json")
    assert [i.entidade.nome for i in Inscricao.objects.all()] == ["Bruno"]  # só quem cumpre o público
    assert Inscricao.objects.get().origem == "entidade_criada"


def test_publico_e_iniciar(api, u, admin):
    p = criar_plano(api, admin)
    Entidade.objects.create(nome="A", responsavel=u, consentimento_marketing=C.CONCEDIDO)
    Entidade.objects.create(nome="B", responsavel=u)
    Entidade.objects.create(nome="C", responsavel=u, consentimento_marketing=C.CONCEDIDO, oposicao_marketing=True)
    r = api.get(reverse("plano-entidades-publico", args=[p["id"]])).json()
    assert r == {
        "total": 3,
        "oposicao": 1,
        "sem_consentimento": 1,
        "autorizadas": 1,
        "ja_inscritas": 0,
        "a_inscrever": 1,
    }
    r = api.post(reverse("plano-entidades-iniciar-publico", args=[p["id"]]), {}, format="json")
    assert r.status_code == 201 and r.json() == {"inscritas": 1}
    assert api.post(reverse("plano-entidades-iniciar-publico", args=[p["id"]]), {}, format="json").json() == {
        "inscritas": 0
    }
