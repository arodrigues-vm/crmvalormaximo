"""Agenda e avisos (F4-02, Cap. 17, D-51)."""

from datetime import date, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.agenda.models import Compromisso
from apps.agenda.servicos import aniversario_em, avisos
from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.entidades.models import Entidade
from apps.tarefas.models import Tarefa
from apps.visitas.models import Visita

pytestmark = pytest.mark.django_db
LISBOA = ZoneInfo("Europe/Lisbon")
HOJE = timezone.localdate()


def v(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


def estado(nome):
    return v("estados_compromisso", nome).pk


@pytest.fixture
def u(criar_utilizador, equipa_norte):
    return criar_utilizador(Perfil.CONSULTOR, equipa_norte)


def criar(api, **extra):
    corpo = {
        "titulo": "Reunião com proprietário",
        "inicio": f"{HOJE}T15:00:00",
        "tipo": v("tipos_compromisso", "Reunião").pk,
    }
    return api.post(reverse("compromisso-list"), {**corpo, **extra}, format="json")


def eventos(api, inicio=HOJE, fim=HOJE, **extra):
    return api.get(reverse("compromisso-eventos"), {"inicio": str(inicio), "fim": str(fim), **extra})


def test_compromisso_estados_com_motivo(api, u):
    api.force_authenticate(u)
    r = criar(api, fim=f"{HOJE}T14:00:00")
    assert r.status_code == 400 and "fim" in r.json()
    r = criar(api, local="Escritório")
    assert r.status_code == 201, r.content
    c = r.json()
    assert c["referencia"].startswith("AGE-") and c["estado_categoria"] == "agendado" and c["responsavel"] == u.pk
    # O estado não muda pela edição; só pelas ações expressas.
    r = api.patch(
        reverse("compromisso-detail", args=[c["id"]]),
        {"estado": estado("Concluído"), "versao": c["versao"]},
        format="json",
    )
    assert r.status_code == 200 and r.json()["estado_categoria"] == "agendado"
    url = reverse("compromisso-mudar-estado", args=[c["id"]])
    assert api.post(url, {"estado": estado("Cancelado")}, format="json").status_code == 400  # motivo
    r = api.post(url, {"estado": estado("Cancelado"), "motivo": "Cliente adiou"}, format="json")
    assert r.status_code == 200 and r.json()["motivo_estado"] == "Cliente adiou"
    assert api.post(url, {"estado": estado("Agendado")}, format="json").status_code == 400  # reabrir: motivo
    r = api.post(url, {"estado": estado("Agendado"), "motivo": "Remarcado"}, format="json")
    assert r.json()["estado_categoria"] == "agendado"
    assert api.post(url, {"estado": estado("Concluído")}, format="json").json()["estado_categoria"] == "concluido"
    hist = api.get(reverse("compromisso-historico", args=[c["id"]])).json()
    assert len(hist) >= 4


def test_eventos_derivados_sem_copias_e_por_pessoa(api, u, criar_utilizador, equipa_norte):
    api.force_authenticate(u)
    criar(api)
    ana = Entidade.objects.create(
        nome="Ana Cliente",
        responsavel=u,
        data_nascimento=date(1980, HOJE.month, HOJE.day) if (HOJE.month, HOJE.day) != (2, 29) else date(1980, 2, 29),
    )
    visita = Visita.objects.create(
        entidade=ana,
        imovel_descricao="Moradia T4",
        data=HOJE,
        hora_entrada=time(10, 0),
        responsavel=u,
        estado=v("estados_visita", "Agendada"),
    )
    Tarefa.objects.create(
        titulo="Mudança de contadores", prazo=HOJE, responsavel=u, estado=v("estados_tarefa", "Por fazer")
    )
    r = eventos(api, pessoa=u.pk)
    assert r.status_code == 200, r.content
    origens = [e["origem"] for e in r.json()]
    assert sorted(origens) == ["aniversario", "compromisso", "tarefa", "visita"]
    aniv = next(e for e in r.json() if e["origem"] == "aniversario")
    assert aniv["titulo"] == f"Aniversário de Ana Cliente ({HOJE.year - 1980} anos)" and aniv["dia_inteiro"]
    vis = next(e for e in r.json() if e["origem"] == "visita")
    assert vis["inicio"].startswith(f"{HOJE}T10:00") and vis["caminho"] == f"/visitas/{visita.pk}"
    # A origem é a fonte de verdade: mudar a visita muda a Agenda (nada foi copiado).
    visita.data = HOJE + timedelta(days=1)
    visita.save()
    assert "visita" not in [e["origem"] for e in eventos(api).json()]
    assert "visita" in [e["origem"] for e in eventos(api, fim=HOJE + timedelta(days=1)).json()]
    # Visitas canceladas só aparecem a pedido.
    visita.estado = v("estados_visita", "Cancelada")
    visita.save()
    assert "visita" not in [e["origem"] for e in eventos(api, fim=HOJE + timedelta(days=1)).json()]
    assert "visita" in [e["origem"] for e in eventos(api, fim=HOJE + timedelta(days=1), cancelados="1").json()]
    # Outro consultor da equipa: não vê nada disto nem pode pedir a agenda de outra pessoa.
    outro = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
    api.force_authenticate(outro)
    assert eventos(api).json() == []
    assert eventos(api, pessoa=u.pk).status_code == 400
    # O Responsável da equipa vê a agenda do consultor.
    chefe = criar_utilizador(Perfil.RESPONSAVEL, equipa_norte)
    api.force_authenticate(chefe)
    assert u.pk in [p["id"] for p in api.get(reverse("compromisso-opcoes")).json()["pessoas"]]
    assert len(eventos(api, pessoa=u.pk).json()) == 3  # sem a visita cancelada


def test_aniversario_29_fevereiro():
    assert aniversario_em(date(1992, 2, 29), 2027) == date(2027, 2, 28)
    assert aniversario_em(date(1992, 2, 29), 2028) == date(2028, 2, 29)


def test_intervalo_limitado(api, u):
    api.force_authenticate(u)
    assert eventos(api, fim=HOJE + timedelta(days=200)).status_code == 400
    assert eventos(api, inicio=HOJE, fim=HOJE - timedelta(days=1)).status_code == 400


def test_avisos_e_dispensar(api, u):
    agora = timezone.now()
    Compromisso.objects.create(
        titulo="Já a seguir",
        inicio=agora + timedelta(hours=3),
        responsavel=u,
        estado=v("estados_compromisso", "Agendado"),
    )
    Compromisso.objects.create(
        titulo="Longe", inicio=agora + timedelta(days=3), responsavel=u, estado=v("estados_compromisso", "Agendado")
    )
    ent = Entidade.objects.create(nome="Bruno", responsavel=u)
    local = timezone.localtime(agora + timedelta(minutes=30), LISBOA)
    Visita.objects.create(
        entidade=ent,
        imovel_descricao="T2",
        data=local.date(),
        hora_entrada=local.time(),
        responsavel=u,
        estado=v("estados_visita", "Agendada"),
    )
    tarde = timezone.localtime(agora + timedelta(hours=3), LISBOA)
    Visita.objects.create(
        entidade=ent,
        imovel_descricao="T3",
        data=tarde.date(),
        hora_entrada=tarde.time(),
        responsavel=u,
        estado=v("estados_visita", "Agendada"),
    )
    Tarefa.objects.create(titulo="Ligar ao cliente", prazo=HOJE, responsavel=u, estado=v("estados_tarefa", "Por fazer"))
    titulos = {a["titulo"] for a in avisos(u, agora)}
    assert titulos == {"Já a seguir", "Visita · Bruno", "Ligar ao cliente"}
    api.force_authenticate(u)
    lista = api.get(reverse("compromisso-avisos")).json()
    chave = next(a["chave"] for a in lista if a["titulo"] == "Ligar ao cliente")
    r = api.post(reverse("compromisso-dispensar-aviso"), {"chave": chave}, format="json")
    assert r.status_code == 204
    assert "Ligar ao cliente" not in {a["titulo"] for a in api.get(reverse("compromisso-avisos")).json()}
    # Outra pessoa não recebe estes avisos.
    assert avisos(_outro(u), agora) == []


def _outro(u):
    from apps.contas.models import Utilizador

    return Utilizador.objects.create_user(
        email="outro@exemplo.pt", password="x" * 12, nome="Outro", perfil=Perfil.CONSULTOR, equipa=u.equipa
    )


def test_parametros_dos_avisos_validados(api, criar_utilizador):
    admin = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(admin)
    url = "/api/parametros/agenda_aviso_visita_minutos/"
    assert api.patch(url, {"valor": "abc"}, format="json").status_code == 400
    r = api.patch(url, {"valor": "90"}, format="json")
    assert r.status_code == 200 and r.json()["valor"] == 90
