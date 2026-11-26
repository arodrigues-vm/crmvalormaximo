"""Pós-Venda: tarefas e documentos do negócio (F3-09, D-50)."""

from datetime import timedelta

import pytest
from django.urls import reverse

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import LigacaoExterna
from apps.tarefas.models import ModeloTarefa, Tarefa
from apps.transacoes.tests.test_api import HOJE, cenario, estado, gerar, mudar, u, v  # noqa: F401

pytestmark = pytest.mark.django_db


def concluir(api, t, efeitos):
    api.post(
        reverse("transacao-mudar-estado", args=[t["id"]]),
        {"estado": estado("CPCV assinado"), "data_cpcv": str(HOJE - timedelta(days=30))},
        format="json",
    )
    return mudar(api, t, "Concluída", data_escritura=str(HOJE - timedelta(days=2)), efeitos=efeitos)


def test_concluir_propoe_modelos_e_cria_so_os_confirmados(api, u, cenario):  # noqa: F811
    api.force_authenticate(u)
    t = gerar(api, cenario).json()
    efeitos = api.get(reverse("transacao-efeitos", args=[t["id"]]), {"estado": estado("Concluída")}).json()
    tarefas = [e for e in efeitos if e["chave"].startswith("tarefa_")]
    assert len(tarefas) == 3  # os três modelos iniciais
    contadores = ModeloTarefa.objects.get(nome="Mudança de contadores")
    r = concluir(api, t, ["imovel_estado", f"tarefa_{contadores.pk}"])
    assert r.status_code == 200, r.content
    tarefa = Tarefa.objects.get()
    assert tarefa.titulo == "Mudança de contadores" and tarefa.transacao_id == t["id"]
    assert tarefa.prazo == HOJE - timedelta(days=2) + timedelta(days=contadores.dias_apos)
    assert tarefa.responsavel == u  # responsável pelo comprador
    assert tarefa.estado.categoria == "aberta" and tarefa.categoria.categoria == "pos_venda"
    assert tarefa.referencia.startswith("TAR-")
    # Os modelos ainda por usar continuam disponíveis para propor mais tarde, sem duplicar.
    proposta = api.get(reverse("tarefa-proposta"), {"transacao": t["id"]}).json()
    assert {m["nome"] for m in proposta} == {"Contacto de acompanhamento", "Aniversário da compra"}
    ids = [m["id"] for m in proposta] + [contadores.pk]
    r = api.post(reverse("tarefa-criar-de-modelos"), {"transacao": t["id"], "modelos": ids}, format="json")
    assert r.status_code == 201 and len(r.json()) == 2
    assert Tarefa.objects.count() == 3
    # Reabrir não mexe nas tarefas.
    r = mudar(api, t, "Em preparação", motivo="Erro", efeitos=[])
    assert r.status_code == 200 and Tarefa.objects.count() == 3


def test_tarefa_manual_exige_transacao_concluida_e_regista_conclusao(api, u, cenario):  # noqa: F811
    api.force_authenticate(u)
    t = gerar(api, cenario).json()
    url = reverse("tarefa-list")
    r = api.post(url, {"titulo": "Entregar chaves", "transacao": t["id"]}, format="json")
    assert r.status_code == 400 and "transacao" in r.json()
    assert api.get(reverse("tarefa-proposta"), {"transacao": t["id"]}).status_code == 400
    concluir(api, t, [])
    r = api.post(
        url, {"titulo": "Entregar chaves", "transacao": t["id"], "prazo": str(HOJE - timedelta(days=1))}, format="json"
    )
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["estado_categoria"] == "aberta" and d["atrasada"] is True and d["responsavel_nome"] == u.nome
    assert [x["id"] for x in api.get(url, {"vista": "atrasadas"}).json()["results"]] == [d["id"]]
    r = api.patch(
        reverse("tarefa-detail", args=[d["id"]]),
        {"estado": v("estados_tarefa", "Concluída").pk, "versao": d["versao"]},
        format="json",
    )
    assert r.status_code == 200, r.content
    assert r.json()["concluida_em"] and r.json()["atrasada"] is False
    assert api.get(url).json()["results"] == []  # vista por omissão: por fazer
    assert len(api.get(url, {"vista": "concluidas"}).json()["results"]) == 1


def test_sem_acesso_a_transacao(api, u, cenario, criar_utilizador, equipa_sul):  # noqa: F811
    api.force_authenticate(u)
    t = gerar(api, cenario).json()
    concluir(api, t, [])
    outro = criar_utilizador(Perfil.CONSULTOR, equipa_sul)
    api.force_authenticate(outro)
    r = api.post(reverse("tarefa-list"), {"titulo": "X", "transacao": t["id"]}, format="json")
    assert r.status_code in (400, 403)
    assert api.get(reverse("tarefa-proposta"), {"transacao": t["id"]}).status_code in (400, 403)


def test_modelos_so_o_administrador_altera(api, u, criar_utilizador):  # noqa: F811
    api.force_authenticate(u)
    url = reverse("modelo-tarefa-list")
    assert [m["nome"] for m in api.get(url).json()][:3] == [
        "Mudança de contadores",
        "Contacto de acompanhamento",
        "Aniversário da compra",
    ]
    assert api.post(url, {"nome": "Novo", "dias_apos": 10}, format="json").status_code == 403
    admin = criar_utilizador(Perfil.ADMINISTRADOR)
    api.force_authenticate(admin)
    r = api.post(url, {"nome": "Pedir testemunho", "dias_apos": 60}, format="json")
    assert r.status_code == 201
    assert (
        api.patch(reverse("modelo-tarefa-detail", args=[r.json()["id"]]), {"ativo": False}, format="json").json()[
            "ativo"
        ]
        is False
    )
    assert api.delete(reverse("modelo-tarefa-detail", args=[r.json()["id"]])).status_code == 405


def test_documentos_da_transacao_por_tipo(api, u, cenario):  # noqa: F811
    api.force_authenticate(u)
    t = gerar(api, cenario).json()
    tipo = ValorLista.objects.filter(lista__chave="tipos_ligacao").first().pk
    url = reverse("transacao-documentos", args=[t["id"]])
    tipos = api.get(url).json()
    nomes = [x["nome"] for x in tipos]
    assert "Escritura" in " ".join(nomes) and "Contrato de arrendamento" not in nomes  # é uma venda
    escritura = next(x for x in tipos if "Escritura" in x["nome"])
    assert escritura["ligacoes"] == []
    r = api.post(
        reverse("transacao-ligacoes", args=[t["id"]]),
        {
            "tipo": tipo,
            "titulo": "Escritura (Drive)",
            "url": "https://exemplo.pt/escritura",
            "tipo_documento": escritura["tipo"],
        },
        format="json",
    )
    assert r.status_code in (200, 201), r.content
    escritura = next(x for x in api.get(url).json() if x["tipo"] == escritura["tipo"])
    assert [x["titulo"] for x in escritura["ligacoes"]] == ["Escritura (Drive)"]
    assert LigacaoExterna.objects.get().tipo_documento_id == escritura["tipo"]
    # Um tipo que não é de documentos é recusado.
    r = api.post(
        reverse("transacao-ligacoes", args=[t["id"]]),
        {"tipo": tipo, "titulo": "X", "url": "https://exemplo.pt/x", "tipo_documento": v("operacoes", "Venda").pk},
        format="json",
    )
    assert r.status_code == 400
