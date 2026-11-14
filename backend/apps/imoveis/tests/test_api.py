import pytest
from django.urls import reverse

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel

pytestmark = pytest.mark.django_db
LISTA = reverse("imovel-list")


def detalhe(pk):
    return reverse("imovel-detail", args=[pk])


def valor(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome).pk


@pytest.fixture
def pessoas(criar_utilizador, equipa_norte, equipa_sul):
    class P:
        admin = criar_utilizador(Perfil.ADMINISTRADOR)
        resp = criar_utilizador(Perfil.RESPONSAVEL, equipa_norte)
        cons = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
        cons2 = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
        cons_sul = criar_utilizador(Perfil.CONSULTOR, equipa_sul)
        assist = criar_utilizador(Perfil.ASSISTENTE, equipa_norte)

    return P


def entidade(u, nome="Ana Ensaio"):
    return Entidade.objects.create(nome=nome, responsavel=u)


def como(api, u):
    api.force_authenticate(u)
    return api


def dados(**extra):
    base = {
        "tipo": valor("tipos_imovel", "Apartamento"),
        "tipologia": valor("tipologias", "T2"),
        "operacao": "venda",
        "estado_comercializacao": valor("estados_comercializacao", "Em preparação"),
        "preco": "250000.00",
        "localidade": "Localidade Ensaio",
        "area_bruta_privativa": "85.50",
        "zonas_exteriores": [valor("zonas_exteriores", "Varanda")],
    }
    base.update(extra)
    return base


def criar(api, u, **extra):
    r = como(api, u).post(LISTA, dados(**extra), format="json")
    assert r.status_code == 201, r.content
    return r.json()


class TestImovel:
    def test_criar(self, api, pessoas):
        i = criar(api, pessoas.cons)
        assert i["referencia"] == f"IMO-{i['id']:06d}"
        assert i["status"] == "ativo"
        assert i["preco"] == "250000.00"
        assert i["nomes"]["tipo"] == "Apartamento" and i["nomes"]["zonas_exteriores"] == ["Varanda"]
        assert i["responsavel"] == pessoas.cons.id
        assert RegistoAuditoria.objects.filter(acao="imovel.criado").exists()

    def test_preco_desconhecido_distinto_de_zero(self, api, pessoas):
        assert criar(api, pessoas.cons, preco=None)["preco"] is None
        assert criar(api, pessoas.cons, preco="0")["preco"] == "0.00"

    @pytest.mark.parametrize(
        "extra, campo",
        [
            ({"preco": "-1"}, "preco"),
            ({"operacao": "troca"}, "operacao"),
            ({"status": "vendido"}, "status"),
            ({"codigo_postal": "12"}, "codigo_postal"),
            ({"ano_construcao": 99}, "ano_construcao"),
            ({"area_util": "-5"}, "area_util"),
        ],
    )
    def test_validacoes(self, api, pessoas, extra, campo):
        r = como(api, pessoas.cons).post(LISTA, dados(**extra), format="json")
        assert r.status_code == 400 and campo in r.json()

    def test_valor_de_outra_lista_recusado(self, api, pessoas):
        r = como(api, pessoas.cons).post(LISTA, dados(tipo=valor("tipologias", "T1")), format="json")
        assert r.status_code == 400 and "tipo" in r.json()

    def test_arquivados_escondidos_por_omissao(self, api, pessoas):
        a = criar(api, pessoas.cons)
        b = criar(api, pessoas.cons, status="arquivado")
        ids = [x["id"] for x in como(api, pessoas.cons).get(LISTA).json()["results"]]
        assert a["id"] in ids and b["id"] not in ids
        arq = como(api, pessoas.cons).get(LISTA, {"status": "arquivado"}).json()["results"]
        assert [x["id"] for x in arq] == [b["id"]]

    def test_filtros_e_pesquisa(self, api, pessoas):
        a = criar(api, pessoas.cons, preco="100000")
        criar(api, pessoas.cons, preco="400000", tipologia=valor("tipologias", "T4"), localidade="Outra Terra")
        c = como(api, pessoas.cons)
        assert [x["id"] for x in c.get(LISTA, {"preco_max": "200000"}).json()["results"]] == [a["id"]]
        assert c.get(LISTA, {"tipologia": valor("tipologias", "T4")}).json()["count"] == 1
        assert c.get(LISTA, {"pesquisa": "outra terra"}).json()["count"] == 1
        assert c.get(LISTA, {"pesquisa": a["referencia"]}).json()["count"] == 1

    def test_permissoes(self, api, pessoas):
        i = criar(api, pessoas.cons)
        assert como(api, pessoas.cons2).get(detalhe(i["id"])).status_code == 404
        assert como(api, pessoas.resp).get(detalhe(i["id"])).status_code == 200
        assert como(api, pessoas.cons_sul).get(LISTA).json()["count"] == 0
        assert como(api, pessoas.assist).delete(detalhe(i["id"])).status_code in (403, 404)

    def test_conflito_versao_e_historico(self, api, pessoas):
        i = criar(api, pessoas.cons)
        c = como(api, pessoas.cons)
        assert c.patch(detalhe(i["id"]), {"preco": "260000", "versao": 1}, format="json").status_code == 200
        r = c.patch(detalhe(i["id"]), {"preco": "270000", "versao": 1}, format="json")
        assert r.status_code == 409 and r.json()["codigo"] == "conflito_versao"
        h = c.get(reverse("imovel-historico", args=[i["id"]])).json()
        assert {"campo": "preco", "antes": "250000.00", "depois": "260000.00"} in h[0]["alteracoes"]

    def test_lixeira(self, api, pessoas):
        i = criar(api, pessoas.cons)
        assert como(api, pessoas.cons).delete(detalhe(i["id"])).status_code == 204
        assert como(api, pessoas.cons).get(LISTA).json()["count"] == 0
        assert como(api, pessoas.resp).post(reverse("imovel-restaurar", args=[i["id"]])).status_code == 200

    def test_valor_de_lista_desativado(self, api, pessoas):
        i = criar(api, pessoas.cons)
        v = ValorLista.objects.get(pk=i["tipo"])
        v.ativo = False
        v.save()
        c = como(api, pessoas.cons)
        # Editar outra coisa mantendo o valor antigo é aceite; escolhê-lo de novo noutro imóvel não.
        assert c.patch(detalhe(i["id"]), {"versao": 1, "tipo": v.pk, "preco": "1"}, format="json").status_code == 200
        assert c.post(LISTA, dados(tipo=v.pk), format="json").status_code == 400


class TestProprietarios:
    def test_varios_proprietarios_com_quotas(self, api, pessoas):
        a, b = entidade(pessoas.cons), entidade(pessoas.cons, "Rui Ensaio")
        i = criar(
            api, pessoas.cons, proprietarios=[{"entidade": a.pk, "quota": "50"}, {"entidade": b.pk, "quota": "50"}]
        )
        det = i["proprietarios_detalhe"]
        assert [(p["nome_completo"], p["quota"]) for p in det] == [("Ana Ensaio", "50.0000"), ("Rui Ensaio", "50.0000")]

    def test_quota_opcional_e_soma_maxima(self, api, pessoas):
        a, b = entidade(pessoas.cons), entidade(pessoas.cons, "Rui Ensaio")
        criar(api, pessoas.cons, proprietarios=[{"entidade": a.pk}])
        r = como(api, pessoas.cons).post(
            LISTA,
            dados(proprietarios=[{"entidade": a.pk, "quota": "60"}, {"entidade": b.pk, "quota": "50"}]),
            format="json",
        )
        assert r.status_code == 400 and "ultrapassa 100%" in str(r.json())

    def test_proprietario_repetido(self, api, pessoas):
        a = entidade(pessoas.cons)
        r = como(api, pessoas.cons).post(
            LISTA, dados(proprietarios=[{"entidade": a.pk}, {"entidade": a.pk}]), format="json"
        )
        assert r.status_code == 400

    def test_so_entidades_acessiveis(self, api, pessoas):
        alheia = entidade(pessoas.cons_sul, "Alheia")
        r = como(api, pessoas.cons).post(LISTA, dados(proprietarios=[{"entidade": alheia.pk}]), format="json")
        assert r.status_code == 400

    def test_proprietario_sem_acesso_fica_anonimo_e_preservado(self, api, pessoas):
        alheia = entidade(pessoas.cons_sul, "Alheia")
        minha = entidade(pessoas.cons)
        i = criar(api, pessoas.admin, responsavel=pessoas.cons.id, proprietarios=[{"entidade": alheia.pk}])
        visto = como(api, pessoas.cons).get(detalhe(i["id"])).json()
        assert visto["proprietarios_detalhe"] == [
            {"entidade": alheia.pk, "acessivel": False, "nome_completo": None, "referencia": None, "quota": None}
        ]
        # O consultor pode acrescentar a sua entidade mantendo a que não vê.
        r = como(api, pessoas.cons).patch(
            detalhe(i["id"]),
            {"versao": visto["versao"], "proprietarios": [{"entidade": alheia.pk}, {"entidade": minha.pk}]},
            format="json",
        )
        assert r.status_code == 200, r.content
        assert len(r.json()["proprietarios_detalhe"]) == 2

    def test_remover_e_alterar_quota(self, api, pessoas):
        a, b = entidade(pessoas.cons), entidade(pessoas.cons, "Rui Ensaio")
        i = criar(api, pessoas.cons, proprietarios=[{"entidade": a.pk, "quota": "50"}, {"entidade": b.pk}])
        r = como(api, pessoas.cons).patch(
            detalhe(i["id"]), {"versao": 1, "proprietarios": [{"entidade": b.pk, "quota": "100"}]}, format="json"
        )
        assert [(p["entidade"], p["quota"]) for p in r.json()["proprietarios_detalhe"]] == [(b.pk, "100.0000")]

    def test_entidade_proprietaria_nao_pode_ser_apagada(self, api, pessoas):
        from django.db.models import ProtectedError

        a = entidade(pessoas.cons)
        criar(api, pessoas.cons, proprietarios=[{"entidade": a.pk}])
        with pytest.raises(ProtectedError):
            a.delete()

    def test_imoveis_da_entidade(self, api, pessoas):
        a = entidade(pessoas.cons)
        i = criar(api, pessoas.cons, proprietarios=[{"entidade": a.pk, "quota": "25"}])
        # Imóvel de outro consultor com a mesma proprietária: só contado.
        Imovel.objects.create(responsavel=pessoas.cons2).proprietarios.create(entidade=a)
        r = como(api, pessoas.cons).get(reverse("entidade-imoveis", args=[a.pk])).json()
        assert [(x["id"], x["quota"]) for x in r["imoveis"]] == [(i["id"], "25.0000")]
        assert r["outros"] == 1

    def test_opcoes(self, api, pessoas):
        o = como(api, pessoas.cons).get(reverse("imovel-opcoes")).json()
        assert "Moradia" in [x["nome"] for x in o["tipos"]]
        assert [x["valor"] for x in o["status"]] == ["ativo", "inativo", "arquivado"]
        assert o["pode_criar"] is True


def test_historico_mostra_nomes_e_nao_identificadores(api, pessoas):
    i = criar(api, pessoas.cons)
    c = como(api, pessoas.cons)
    c.patch(
        detalhe(i["id"]), {"versao": 1, "tipo": valor("tipos_imovel", "Moradia"), "status": "inativo"}, format="json"
    )
    alt = c.get(reverse("imovel-historico", args=[i["id"]])).json()[0]["alteracoes"]
    assert {"campo": "tipo", "antes": "Apartamento", "depois": "Moradia"} in alt
    assert {"campo": "status", "antes": "Ativo", "depois": "Inativo"} in alt
