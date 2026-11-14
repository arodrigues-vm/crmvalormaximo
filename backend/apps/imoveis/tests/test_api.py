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
        "operacao": valor("operacoes", "Venda"),
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
        assert i["nomes"]["status"] == "Ativo" and i["nomes"]["status_categoria"] == "ativo"
        assert i["nomes"]["operacao_categoria"] == "venda"
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
            ({"operacao": None}, "operacao"),
            ({"status": 999999}, "status"),
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
        b = criar(api, pessoas.cons, status=valor("status_imovel", "Arquivado"))
        ids = [x["id"] for x in como(api, pessoas.cons).get(LISTA).json()["results"]]
        assert a["id"] in ids and b["id"] not in ids
        arq = como(api, pessoas.cons).get(LISTA, {"status": valor("status_imovel", "Arquivado")}).json()["results"]
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
        assert [(x["nome"], x["categoria"]) for x in o["status"]] == [
            ("Ativo", "ativo"),
            ("Inativo", "inativo"),
            ("Arquivado", "arquivado"),
        ]
        assert o["pode_criar"] is True


def test_historico_mostra_nomes_e_nao_identificadores(api, pessoas):
    i = criar(api, pessoas.cons)
    c = como(api, pessoas.cons)
    c.patch(
        detalhe(i["id"]),
        {"versao": 1, "tipo": valor("tipos_imovel", "Moradia"), "status": valor("status_imovel", "Inativo")},
        format="json",
    )
    alt = c.get(reverse("imovel-historico", args=[i["id"]])).json()[0]["alteracoes"]
    assert {"campo": "tipo", "antes": "Apartamento", "depois": "Moradia"} in alt
    assert {"campo": "status", "antes": "Ativo", "depois": "Inativo"} in alt


def test_novo_status_com_categoria_arquivado_tambem_fica_escondido(api, pessoas):
    from apps.configuracao.models import Lista, ValorLista

    vendido = ValorLista.objects.create(
        lista=Lista.objects.get(chave="status_imovel"), nome="Vendido e fechado", categoria="arquivado"
    )
    criar(api, pessoas.cons, status=vendido.pk)
    assert como(api, pessoas.cons).get(LISTA).json()["count"] == 0


class TestFotografia:
    @staticmethod
    def imagem(formato="JPEG", tamanho=(2400, 1200)):
        from io import BytesIO

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        b = BytesIO()
        Image.new("RGB", tamanho, (11, 37, 69)).save(b, formato)
        return SimpleUploadedFile(f"foto.{formato.lower()}", b.getvalue(), content_type=f"image/{formato.lower()}")

    @pytest.fixture(autouse=True)
    def _media(self, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path

    def test_carregar_ver_substituir_e_remover(self, api, pessoas, tmp_path):
        from PIL import Image

        i = criar(api, pessoas.cons)
        url = reverse("imovel-fotografia", args=[i["id"]])
        c = como(api, pessoas.cons)
        assert c.get(url).status_code == 404
        r = c.post(url, {"ficheiro": self.imagem()}, format="multipart")
        assert r.status_code == 200, r.content
        assert r.json()["tem_fotografia"] is True
        foto = c.get(url)
        assert foto.status_code == 200 and foto["Content-Type"] == "image/webp"
        assert "private" in foto["Cache-Control"]
        img = Image.open(__import__("io").BytesIO(b"".join(foto.streaming_content)))
        assert max(img.size) == 1600  # redimensionada
        mini = Image.open(__import__("io").BytesIO(b"".join(c.get(url, {"tamanho": "miniatura"}).streaming_content)))
        assert max(mini.size) == 480
        # Substituir apaga os ficheiros anteriores.
        c.post(url, {"ficheiro": self.imagem("PNG", (300, 200))}, format="multipart")
        assert len(list((tmp_path / "imoveis" / str(i["id"])).iterdir())) == 2
        assert c.delete(url).json()["tem_fotografia"] is False
        assert list((tmp_path / "imoveis" / str(i["id"])).iterdir()) == []
        assert RegistoAuditoria.objects.filter(acao="imovel.fotografia_alterada").count() == 2

    def test_rejeita_ficheiro_que_nao_e_imagem(self, api, pessoas):
        from django.core.files.uploadedfile import SimpleUploadedFile

        i = criar(api, pessoas.cons)
        falso = SimpleUploadedFile("foto.jpg", b"<script>alert(1)</script>", content_type="image/jpeg")
        r = como(api, pessoas.cons).post(
            reverse("imovel-fotografia", args=[i["id"]]), {"ficheiro": falso}, format="multipart"
        )
        assert r.status_code == 400 and "imagem válida" in str(r.json())

    def test_sem_acesso_nao_ve_nem_altera(self, api, pessoas):
        i = criar(api, pessoas.cons)
        url = reverse("imovel-fotografia", args=[i["id"]])
        como(api, pessoas.cons).post(url, {"ficheiro": self.imagem()}, format="multipart")
        assert como(api, pessoas.cons2).get(url).status_code == 404
        assert como(api, pessoas.cons2).post(url, {"ficheiro": self.imagem()}, format="multipart").status_code == 404
        api.force_authenticate(None)
        assert api.get(url).status_code == 401


class TestLigacoes:
    def test_adicionar_listar_e_remover(self, api, pessoas):
        i = criar(api, pessoas.cons)
        url = reverse("imovel-ligacoes", args=[i["id"]])
        c = como(api, pessoas.cons)
        r = c.post(
            url,
            {"tipo": valor("tipos_ligacao", "Fotografias"), "titulo": "Fotos", "url": "https://onedrive.live.com/x"},
            format="json",
        )
        assert r.status_code == 201, r.content
        assert r.json()[0]["tipo_nome"] == "Fotografias"
        lid = r.json()[0]["id"]
        assert como(api, pessoas.resp).get(url).json()[0]["url"] == "https://onedrive.live.com/x"
        assert como(api, pessoas.cons2).get(url).status_code == 404
        c = como(api, pessoas.cons)
        assert c.delete(reverse("imovel-remover-ligacao", args=[i["id"], lid])).status_code == 204
        assert c.get(url).json() == []
        assert RegistoAuditoria.objects.filter(acao="imovel.ligacao_removida").exists()

    @pytest.mark.parametrize("endereco", ["javascript:alert(1)", "ftp://x.pt/a", "não é url"])
    def test_rejeita_enderecos_invalidos(self, api, pessoas, endereco):
        i = criar(api, pessoas.cons)
        r = como(api, pessoas.cons).post(
            reverse("imovel-ligacoes", args=[i["id"]]),
            {"tipo": valor("tipos_ligacao", "Documentos"), "titulo": "Docs", "url": endereco},
            format="json",
        )
        assert r.status_code == 400

    def test_assistente_sem_edicao_nao_adiciona(self, api, pessoas):
        i = criar(api, pessoas.resp)
        from apps.imoveis.models import Imovel

        Imovel.objects.get(pk=i["id"]).partilhada_com.add(pessoas.assist)
        # O assistente pode editar registos partilhados (matriz por omissão); um consultor de outra equipa não vê.
        r = como(api, pessoas.cons_sul).post(
            reverse("imovel-ligacoes", args=[i["id"]]),
            {"tipo": valor("tipos_ligacao", "Outro"), "titulo": "X", "url": "https://exemplo.pt"},
            format="json",
        )
        assert r.status_code == 404


def test_status_vazio_fica_ativo_e_mantem_se_na_edicao(api, pessoas):
    i = criar(api, pessoas.cons, status=None)
    assert i["nomes"]["status"] == "Ativo"
    r = como(api, pessoas.cons).patch(detalhe(i["id"]), {"versao": i["versao"], "status": None}, format="json")
    assert r.status_code == 200 and r.json()["nomes"]["status"] == "Ativo"
