import pytest
from django.urls import reverse

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade

pytestmark = pytest.mark.django_db

LISTA = reverse("entidade-list")


def detalhe(pk):
    return reverse("entidade-detail", args=[pk])


def dados(**extra):
    base = {
        "tipo_pessoa": "singular",
        "nome": "José",
        "apelido": "Ensaio Silva",
        "nif": "123456789",
        "email": "jose.ensaio@exemplo.pt",
        "telefones": [{"regiao": "PT", "numero": "912345678", "tipo": "movel"}],
    }
    base.update(extra)
    return base


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


def como(api, u):
    api.force_authenticate(u)
    return api


def criar(api, u, **extra):
    r = como(api, u).post(LISTA, dados(**extra), format="json")
    assert r.status_code == 201, r.content
    return r.json()


class TestCriar:
    def test_cria_com_referencia_responsavel_e_auditoria(self, api, pessoas):
        e = criar(api, pessoas.cons)
        assert e["referencia"] == f"ENT-{e['id']:06d}"
        assert e["nome_completo"] == "José Ensaio Silva"
        assert e["responsavel"] == pessoas.cons.id
        assert e["telefones"][0]["numero_e164"] == "+351912345678"
        assert e["telefones"][0]["principal"] is True
        assert e["consentimento_marketing"] == "desconhecido"
        assert e["acoes"] == {"editar": True, "eliminar": True, "transferir": False}
        assert RegistoAuditoria.objects.filter(acao="entidade.criada", objeto_id=str(e["id"])).exists()

    def test_sem_sessao(self, api):
        assert api.get(LISTA).status_code == 401

    @pytest.mark.parametrize(
        "extra, campo",
        [
            ({"nif": "123456780"}, "nif"),
            ({"nome": "  "}, "nome"),
            ({"telefones": [{"regiao": "PT", "numero": "123"}]}, "telefones"),
            ({"codigo_postal": "1000"}, "codigo_postal"),
            ({"tipo_pessoa": "coletiva", "data_nascimento": "1980-01-01"}, "data_nascimento"),
            ({"consentimento_marketing": "concedido"}, "consentimento_marketing_em"),
        ],
    )
    def test_validacoes(self, api, pessoas, extra, campo):
        r = como(api, pessoas.cons).post(LISTA, dados(**extra), format="json")
        assert r.status_code == 400
        assert campo in r.json()

    def test_nif_estrangeiro_nao_valida_digito_pt(self, api, pessoas):
        e = criar(api, pessoas.cons, pais_fiscal="ES", nif="X1234567L")
        assert e["nif"] == "X1234567L"

    def test_pessoa_coletiva_ignora_apelido(self, api, pessoas):
        e = criar(api, pessoas.cons, tipo_pessoa="coletiva", nome="Imobiliária Ensaio, Lda.", nif="501442600")
        assert e["nome_completo"] == "Imobiliária Ensaio, Lda."
        assert e["apelido"] == ""

    def test_papeis(self, api, pessoas):
        p = ValorLista.objects.get(lista__chave="papeis_entidade", nome="Comprador")
        e = criar(api, pessoas.cons, papeis=[p.id])
        assert e["papeis_nomes"] == ["Comprador"]

    def test_assistente_cria_e_fica_responsavel(self, api, pessoas):
        e = criar(api, pessoas.assist)
        assert e["responsavel"] == pessoas.assist.id


class TestDuplicados:
    def test_nif_repetido_exige_confirmacao(self, api, pessoas):
        original = criar(api, pessoas.cons)
        r = como(api, pessoas.cons).post(LISTA, dados(email="", telefones=[]), format="json")
        assert r.status_code == 409
        corpo = r.json()
        assert corpo["codigo"] == "possivel_duplicado"
        assert corpo["candidatos"][0]["id"] == original["id"]
        assert corpo["candidatos"][0]["motivos"] == ["nif"]
        ok = como(api, pessoas.cons).post(LISTA, dados(email="", telefones=[], confirmar_duplicado=True), format="json")
        assert ok.status_code == 201
        assert RegistoAuditoria.objects.filter(acao="entidade.duplicado_confirmado").exists()

    def test_telefone_repetido_de_outro_consultor_nao_revela_dados(self, api, pessoas):
        criar(api, pessoas.cons_sul)
        r = como(api, pessoas.cons).post(
            LISTA, dados(nif="", email="outro@exemplo.pt", nome="Outra Pessoa"), format="json"
        )
        assert r.status_code == 409
        assert r.json()["candidatos"] == []
        assert r.json()["outros"] == 1

    def test_nome_parecido_nao_bloqueia_mas_e_sugerido(self, api, pessoas):
        criar(api, pessoas.cons)
        r = como(api, pessoas.cons).post(
            LISTA, dados(nome="Jose", nif="", email="", telefones=[], apelido="Ensaio Silva"), format="json"
        )
        assert r.status_code == 201
        verif = api.post(reverse("entidade-duplicados"), {"nome": "José Ensaio Silva"}, format="json").json()
        assert len(verif["candidatos"]) == 2
        assert all(c["motivos"] == ["nome"] for c in verif["candidatos"])

    def test_entidade_na_lixeira_nao_conta(self, api, pessoas):
        e = criar(api, pessoas.cons)
        como(api, pessoas.cons).delete(detalhe(e["id"]))
        r = como(api, pessoas.cons).post(LISTA, dados(), format="json")
        assert r.status_code == 201


class TestPermissoes:
    def test_consultor_so_ve_os_seus(self, api, pessoas):
        minha = criar(api, pessoas.cons)
        outra = criar(api, pessoas.cons2, nif="", email="b@exemplo.pt", telefones=[])
        lista = como(api, pessoas.cons).get(LISTA).json()["results"]
        assert [e["id"] for e in lista] == [minha["id"]]
        assert como(api, pessoas.cons).get(detalhe(outra["id"])).status_code == 404

    def test_responsavel_ve_a_equipa_mas_nao_outras(self, api, pessoas):
        a = criar(api, pessoas.cons)
        b = criar(api, pessoas.cons_sul, nif="", email="sul@exemplo.pt", telefones=[])
        ids = {e["id"] for e in como(api, pessoas.resp).get(LISTA).json()["results"]}
        assert a["id"] in ids and b["id"] not in ids

    def test_partilha_da_acesso(self, api, pessoas):
        e = criar(api, pessoas.cons)
        Entidade.objects.get(pk=e["id"]).partilhada_com.add(pessoas.cons2)
        assert como(api, pessoas.cons2).get(detalhe(e["id"])).status_code == 200

    def test_assistente_nao_elimina(self, api, pessoas):
        e = criar(api, pessoas.assist)
        assert como(api, pessoas.assist).delete(detalhe(e["id"])).status_code == 403

    def test_consultor_nao_atribui_a_outro(self, api, pessoas):
        r = como(api, pessoas.cons).post(LISTA, dados(responsavel=pessoas.cons2.id), format="json")
        assert r.status_code == 403

    def test_responsavel_transfere_dentro_da_equipa_e_fica_auditado(self, api, pessoas):
        e = criar(api, pessoas.cons)
        r = como(api, pessoas.resp).patch(
            detalhe(e["id"]), {"responsavel": pessoas.cons2.id, "versao": e["versao"]}, format="json"
        )
        assert r.status_code == 200, r.content
        assert RegistoAuditoria.objects.filter(acao="entidade.transferida", objeto_id=str(e["id"])).exists()
        fora = como(api, pessoas.resp).patch(
            detalhe(e["id"]), {"responsavel": pessoas.cons_sul.id, "versao": r.json()["versao"]}, format="json"
        )
        assert fora.status_code == 403

    def test_consultor_nao_muda_responsavel_na_edicao(self, api, pessoas):
        e = criar(api, pessoas.cons)
        r = como(api, pessoas.cons).patch(
            detalhe(e["id"]), {"responsavel": pessoas.cons2.id, "versao": e["versao"]}, format="json"
        )
        assert r.status_code == 403


class TestEditar:
    def test_conflito_de_versao(self, api, pessoas):
        e = criar(api, pessoas.cons)
        c = como(api, pessoas.cons)
        assert c.patch(detalhe(e["id"]), {"nome": "A", "versao": e["versao"]}, format="json").status_code == 200
        r = c.patch(detalhe(e["id"]), {"nome": "B", "versao": e["versao"]}, format="json")
        assert r.status_code == 409
        assert r.json()["codigo"] == "conflito_versao"

    def test_versao_obrigatoria(self, api, pessoas):
        e = criar(api, pessoas.cons)
        assert como(api, pessoas.cons).patch(detalhe(e["id"]), {"nome": "A"}, format="json").status_code == 400

    def test_substituir_telefones_e_principal(self, api, pessoas):
        e = criar(api, pessoas.cons)
        tel = e["telefones"][0]
        r = como(api, pessoas.cons).patch(
            detalhe(e["id"]),
            {
                "versao": e["versao"],
                "telefones": [
                    {"id": tel["id"], "regiao": "PT", "numero": "912345678", "principal": False},
                    {"regiao": "FR", "numero": "0612345678", "principal": True},
                ],
            },
            format="json",
        )
        assert r.status_code == 200, r.content
        tels = r.json()["telefones"]
        assert [t["numero_e164"] for t in tels] == ["+33612345678", "+351912345678"]
        assert tels[1]["id"] == tel["id"]

    def test_dois_principais_recusado(self, api, pessoas):
        e = criar(api, pessoas.cons)
        r = como(api, pessoas.cons).patch(
            detalhe(e["id"]),
            {
                "versao": e["versao"],
                "telefones": [
                    {"regiao": "PT", "numero": "912345678", "principal": True},
                    {"regiao": "PT", "numero": "212345678", "principal": True},
                ],
            },
            format="json",
        )
        assert r.status_code == 400

    def test_alteracao_auditada_com_campos(self, api, pessoas):
        e = criar(api, pessoas.cons)
        como(api, pessoas.cons).patch(detalhe(e["id"]), {"localidade": "Ensaio", "versao": 1}, format="json")
        reg = RegistoAuditoria.objects.filter(acao="entidade.alterada").latest("id")
        assert reg.dados == {"localidade": ["", "Ensaio"]}

    def test_historico(self, api, pessoas):
        e = criar(api, pessoas.cons)
        como(api, pessoas.cons).patch(detalhe(e["id"]), {"localidade": "Ensaio", "versao": 1}, format="json")
        h = api.get(reverse("entidade-historico", args=[e["id"]])).json()
        assert h[0]["tipo"] == "alteração"
        assert {"campo": "localidade", "antes": "", "depois": "Ensaio"} in h[0]["alteracoes"]
        assert h[-1]["tipo"] == "criação"


class TestPesquisaELixeira:
    def test_pesquisa_ignora_acentos_e_maiusculas(self, api, pessoas):
        e = criar(api, pessoas.cons)
        c = como(api, pessoas.cons)
        for termo in ["jose", "JOSÉ", "ensaio sil", "912345", "123456789", e["referencia"]]:
            assert [x["id"] for x in c.get(LISTA, {"pesquisa": termo}).json()["results"]] == [e["id"]], termo
        assert c.get(LISTA, {"pesquisa": "inexistente"}).json()["count"] == 0

    def test_lixeira_e_restauro(self, api, pessoas):
        e = criar(api, pessoas.cons)
        assert como(api, pessoas.cons).delete(detalhe(e["id"])).status_code == 204
        assert como(api, pessoas.cons).get(LISTA).json()["count"] == 0
        # O consultor não tem permissão de restaurar; o responsável de equipa tem.
        assert como(api, pessoas.cons).post(reverse("entidade-restaurar", args=[e["id"]])).status_code == 403
        lixo = como(api, pessoas.resp).get(reverse("entidade-lixeira")).json()["results"]
        assert [x["id"] for x in lixo] == [e["id"]]
        assert como(api, pessoas.resp).post(reverse("entidade-restaurar", args=[e["id"]])).status_code == 200
        assert como(api, pessoas.cons).get(LISTA).json()["count"] == 1
        assert Entidade.objects.filter(pk=e["id"]).exists()

    def test_opcoes(self, api, pessoas):
        o = como(api, pessoas.cons).get(reverse("entidade-opcoes")).json()
        assert "Proprietário" in [p["nome"] for p in o["papeis"]]
        assert o["pode_criar"] is True and o["pode_transferir"] is False


class TestRelacoes:
    @pytest.fixture
    def tipos(self):
        from apps.entidades.models import TipoRelacao

        return {t.nome: t for t in TipoRelacao.objects.all()}

    def _rel(self, api, u, e, **corpo):
        return como(api, u).post(reverse("entidade-relacoes", args=[e]), corpo, format="json")

    def test_tipos_iniciais(self, tipos):
        assert set(tipos) == {"Cônjuge", "Familiar", "Sócio de", "Gerente de"}
        assert tipos["Cônjuge"].simetrica and tipos["Gerente de"].nome_inverso == "Tem como gerente"

    def test_relacao_assimetrica_aparece_nos_dois_sentidos(self, api, pessoas, tipos):
        pessoa = criar(api, pessoas.cons)
        empresa = criar(
            api, pessoas.cons, tipo_pessoa="coletiva", nome="Empresa Ensaio", nif="", email="", telefones=[]
        )
        r = self._rel(api, pessoas.cons, pessoa["id"], tipo=tipos["Gerente de"].id, entidade=empresa["id"])
        assert r.status_code == 201, r.content
        assert r.json()[0]["rotulo"] == "Gerente de"
        assert r.json()[0]["entidade"]["id"] == empresa["id"]
        lado_empresa = api.get(reverse("entidade-relacoes", args=[empresa["id"]])).json()
        assert lado_empresa[0]["rotulo"] == "Tem como gerente"
        assert lado_empresa[0]["entidade"]["id"] == pessoa["id"]
        assert RegistoAuditoria.objects.filter(acao="entidade.relacao_criada").exists()

    def test_sentido_inverso(self, api, pessoas, tipos):
        pessoa = criar(api, pessoas.cons)
        empresa = criar(
            api, pessoas.cons, tipo_pessoa="coletiva", nome="Empresa Ensaio", nif="", email="", telefones=[]
        )
        r = self._rel(
            api, pessoas.cons, empresa["id"], tipo=tipos["Gerente de"].id, entidade=pessoa["id"], sentido="inverso"
        )
        assert r.json()[0]["rotulo"] == "Tem como gerente"
        assert api.get(reverse("entidade-relacoes", args=[pessoa["id"]])).json()[0]["rotulo"] == "Gerente de"

    def test_simetrica_nao_duplica_ao_contrario(self, api, pessoas, tipos):
        a = criar(api, pessoas.cons)
        b = criar(api, pessoas.cons, nome="Maria", nif="", email="", telefones=[])
        assert self._rel(api, pessoas.cons, a["id"], tipo=tipos["Cônjuge"].id, entidade=b["id"]).status_code == 201
        r = self._rel(api, pessoas.cons, b["id"], tipo=tipos["Cônjuge"].id, entidade=a["id"])
        assert r.status_code == 400
        assert api.get(reverse("entidade-relacoes", args=[b["id"]])).json()[0]["rotulo"] == "Cônjuge"

    def test_nao_relaciona_consigo_propria(self, api, pessoas, tipos):
        a = criar(api, pessoas.cons)
        assert self._rel(api, pessoas.cons, a["id"], tipo=tipos["Familiar"].id, entidade=a["id"]).status_code == 400

    def test_exige_acesso_a_outra_entidade_e_nao_revela_dados(self, api, pessoas, tipos):
        minha = criar(api, pessoas.cons)
        alheia = criar(api, pessoas.cons_sul, nome="Alheia", nif="", email="x@exemplo.pt", telefones=[])
        r = self._rel(api, pessoas.cons, minha["id"], tipo=tipos["Familiar"].id, entidade=alheia["id"])
        assert r.status_code == 400
        # Uma relação criada por quem vê as duas (admin) não revela a entidade a quem não a pode ver.
        self._rel(api, pessoas.admin, minha["id"], tipo=tipos["Familiar"].id, entidade=alheia["id"])
        vistas = como(api, pessoas.cons).get(reverse("entidade-relacoes", args=[minha["id"]])).json()
        assert vistas == [{"id": vistas[0]["id"], "tipo": tipos["Familiar"].id, "rotulo": "Familiar",
                           "acessivel": False, "entidade": None, "observacoes": ""}]  # fmt: skip

    def test_assistente_so_le_e_remover_exige_editar(self, api, pessoas, tipos):
        a = criar(api, pessoas.cons)
        b = criar(api, pessoas.cons, nome="Maria", nif="", email="", telefones=[])
        rel = self._rel(api, pessoas.cons, a["id"], tipo=tipos["Familiar"].id, entidade=b["id"]).json()[0]
        url = reverse("entidade-remover-relacao", args=[a["id"], rel["id"]])
        assert como(api, pessoas.cons2).delete(url).status_code == 404  # sem acesso à entidade
        assert como(api, pessoas.cons).delete(url).status_code == 204
        assert api.get(reverse("entidade-relacoes", args=[b["id"]])).json() == []
        assert RegistoAuditoria.objects.filter(acao="entidade.relacao_removida").exists()

    def test_entidade_com_relacoes_nao_pode_ser_apagada_fisicamente(self, api, pessoas, tipos):
        from django.db.models import ProtectedError

        a = criar(api, pessoas.cons)
        b = criar(api, pessoas.cons, nome="Maria", nif="", email="", telefones=[])
        self._rel(api, pessoas.cons, a["id"], tipo=tipos["Familiar"].id, entidade=b["id"])
        with pytest.raises(ProtectedError):
            Entidade.objects.get(pk=a["id"]).delete()


class TestAlteracoes17Nov:
    """D-34: Status como lista, quem recomendou, imóvel de contacto, aniversário nas relações."""

    def test_status_por_omissao_ativo_e_filtro(self, api, pessoas):
        e = criar(api, pessoas.cons)
        assert e["status_nome"] == "Ativo" and e["status_categoria"] == "ativo"
        inativo = ValorLista.objects.get(lista__chave="status_entidade", nome="Inativo")
        r = api.patch(detalhe(e["id"]), {"status": inativo.id, "versao": e["versao"]}, format="json")
        assert r.status_code == 200 and r.json()["status_nome"] == "Inativo"
        assert api.get(LISTA, {"status": inativo.id}).json()["count"] == 1
        ativo = ValorLista.objects.get(lista__chave="status_entidade", nome="Ativo")
        assert api.get(LISTA, {"status": ativo.id}).json()["count"] == 0

    def test_lista_tipo_de_cliente(self):
        from apps.configuracao.models import Lista

        assert Lista.objects.get(chave="papeis_entidade").nome == "Tipos de cliente"

    def test_quem_recomendou_e_imovel_de_contacto(self, api, pessoas):
        from apps.imoveis.models import Imovel

        amigo = criar(api, pessoas.cons, nome="Amigo", nif="", email="amigo@exemplo.pt", telefones=[])
        i = Imovel.objects.create(responsavel=pessoas.cons, localidade="Maia")
        e = criar(
            api, pessoas.cons, quem_recomendou=amigo["id"], imovel_contacto=i.id,
            visitou_imovel_contacto=False, motivo_nao_visitou="Já estava reservado",
        )  # fmt: skip
        assert e["quem_recomendou_dados"] == {"id": amigo["id"], "referencia": amigo["referencia"],
                                              "nome": amigo["nome_completo"], "acessivel": True}  # fmt: skip
        assert e["imovel_contacto_dados"]["referencia"] == i.referencia
        assert e["motivo_nao_visitou"] == "Já estava reservado"
        r = api.patch(detalhe(e["id"]), {"visitou_imovel_contacto": True, "versao": e["versao"]}, format="json")
        assert r.json()["motivo_nao_visitou"] == ""  # se visitou, não há motivo

    def test_nao_liga_registos_sem_acesso(self, api, pessoas):
        from apps.imoveis.models import Imovel

        alheia = criar(api, pessoas.cons_sul, nome="Alheia", nif="", email="a@exemplo.pt", telefones=[])
        i = Imovel.objects.create(responsavel=pessoas.cons_sul)
        r = como(api, pessoas.cons).post(LISTA, dados(quem_recomendou=alheia["id"]), format="json")
        assert r.status_code == 400 and "quem_recomendou" in str(r.json())
        r = como(api, pessoas.cons).post(LISTA, dados(imovel_contacto=i.id), format="json")
        assert r.status_code == 400 and "imovel_contacto" in str(r.json())

    def test_aniversario_ao_relacionar(self, api, pessoas):
        from apps.entidades.models import TipoRelacao

        a = criar(api, pessoas.cons)
        b = criar(api, pessoas.cons, nome="Maria", nif="", email="", telefones=[])
        conjuge = TipoRelacao.objects.get(nome="Cônjuge")
        r = como(api, pessoas.cons).post(
            reverse("entidade-relacoes", args=[a["id"]]),
            {"tipo": conjuge.id, "entidade": b["id"], "data_nascimento": "1980-03-15"},
            format="json",
        )
        assert r.status_code == 201, r.content
        assert r.json()[0]["entidade"]["data_nascimento"] == "1980-03-15"
        assert Entidade.objects.get(pk=b["id"]).data_nascimento.isoformat() == "1980-03-15"
