from datetime import date, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.angariacoes.models import Angariacao, calcular_fim
from apps.angariacoes.servicos import alerta
from apps.configuracao.models import Parametro, ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel, Proprietario

pytestmark = pytest.mark.django_db
LISTA = reverse("angariacao-list")
HOJE = timezone.localdate()


def detalhe(pk, acao=None):
    return reverse(f"angariacao-{acao}" if acao else "angariacao-detail", args=[pk])


def valor(lista, nome):
    return ValorLista.objects.get(lista__chave=lista, nome=nome)


@pytest.fixture
def pessoas(criar_utilizador, equipa_norte, equipa_sul):
    class P:
        admin = criar_utilizador(Perfil.ADMINISTRADOR)
        resp = criar_utilizador(Perfil.RESPONSAVEL, equipa_norte)
        cons = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
        cons2 = criar_utilizador(Perfil.CONSULTOR, equipa_norte)

    return P


@pytest.fixture
def imovel(pessoas):
    i = Imovel.objects.create(responsavel=pessoas.cons, operacao=valor("operacoes", "Venda"), localidade="Ensaio")
    ana = Entidade.objects.create(nome="Ana Ensaio", responsavel=pessoas.cons)
    rui = Entidade.objects.create(nome="Rui Ensaio", responsavel=pessoas.cons)
    Proprietario.objects.create(imovel=i, entidade=ana, quota=60)
    Proprietario.objects.create(imovel=i, entidade=rui, quota=40)
    return i


def como(api, u):
    api.force_authenticate(u)
    return api


def criar(api, u, imovel, **extra):
    corpo = {"imovel": imovel.pk, "regime": valor("regimes_cmi", "Exclusivo").pk}
    corpo.update(extra)
    r = como(api, u).post(LISTA, corpo, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def assinado(inicio=HOJE - timedelta(days=10), prazo=6):
    return {"data_assinatura": str(inicio), "data_inicio": str(inicio), "prazo_meses": prazo}


class TestDatas:
    def test_calcular_fim(self):
        assert calcular_fim(date(2026, 1, 1), 6) == date(2026, 6, 30)
        assert calcular_fim(date(2026, 1, 31), 1) == date(2026, 2, 27)  # 28/02 − 1 dia
        assert calcular_fim(date(2027, 3, 15), 12) == date(2028, 3, 14)

    def test_por_assinar_e_ativa(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel)
        assert c["estado"] == "por_assinar" and c["referencia"] == f"CMI-{c['id']:06d}"
        assert c["nomes"]["operacao"] == "Venda"  # herdada do imóvel
        a = criar(api, pessoas.cons, imovel, regime=valor("regimes_cmi", "Não exclusivo").pk, **assinado())
        assert a["estado"] == "ativa"
        assert a["data_fim"] == a["data_fim_vigente"] == str(calcular_fim(HOJE - timedelta(days=10), 6))

    def test_operacao_vazia_herda_do_imovel(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, operacao=None)
        assert c["nomes"]["operacao"] == "Venda"

    def test_assinatura_exige_inicio_e_prazo(self, api, pessoas, imovel):
        r = como(api, pessoas.cons).post(LISTA, {"imovel": imovel.pk, "data_assinatura": str(HOJE)}, format="json")
        assert r.status_code == 400 and "data_inicio" in r.json()

    def test_expirada(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado(HOJE - timedelta(days=400), 6))
        assert c["estado"] == "expirada" and c["alerta"] is None


class TestIntervenientes:
    def test_preenchidos_com_proprietarios_e_independentes_do_imovel(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel)
        partes = [(i["nome_completo"], i["papel_nome"], i["quota"]) for i in c["intervenientes_detalhe"]]
        assert partes == [("Ana Ensaio", "Proprietário", "60.0000"), ("Rui Ensaio", "Proprietário", "40.0000")]
        # Mudar os proprietários do imóvel não altera as partes do contrato (fotografia própria).
        imovel.proprietarios.all().delete()
        depois = como(api, pessoas.cons).get(detalhe(c["id"])).json()["intervenientes_detalhe"]
        assert len(depois) == 2


class TestEdicaoAssinado:
    def test_dados_contratuais_bloqueados_apos_assinatura(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        r = como(api, pessoas.cons).patch(
            detalhe(c["id"]), {"versao": c["versao"], "data_inicio": str(HOJE)}, format="json"
        )
        assert r.status_code == 400 and "correção material" in r.json()["data_inicio"][0]
        # Outros campos continuam editáveis.
        ok = como(api, pessoas.cons).patch(
            detalhe(c["id"]), {"versao": c["versao"], "numero_contrato": "123/2026"}, format="json"
        )
        assert ok.status_code == 200


class TestSobreposicao:
    def test_exclusivo_impede_sobreposicao(self, api, pessoas, imovel):
        criar(api, pessoas.cons, imovel, **assinado())
        r = como(api, pessoas.cons).post(
            LISTA,
            {"imovel": imovel.pk, "regime": valor("regimes_cmi", "Não exclusivo").pk, **assinado(HOJE, 3)},
            format="json",
        )
        assert r.status_code == 400 and "exclusivo" in str(r.json())

    def test_nao_exclusivos_podem_coexistir(self, api, pessoas, imovel):
        ne = valor("regimes_cmi", "Não exclusivo").pk
        criar(api, pessoas.cons, imovel, regime=ne, **assinado())
        criar(api, pessoas.cons, imovel, regime=ne, **assinado(HOJE, 3))

    def test_sem_sobreposicao_temporal_e_permitido(self, api, pessoas, imovel):
        criar(api, pessoas.cons, imovel, **assinado(HOJE - timedelta(days=400), 6))
        criar(api, pessoas.cons, imovel, **assinado())

    def test_cancelado_nao_conta(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        como(api, pessoas.cons).post(detalhe(c["id"], "situacao"), {"situacao": "cancelada", "motivo": "Revogado"})
        criar(api, pessoas.cons, imovel, **assinado(HOJE, 3))
        # Reabrir o cancelado agora geraria sobreposição.
        r = como(api, pessoas.resp).post(detalhe(c["id"], "situacao"), {"situacao": "em_curso", "motivo": "Erro"})
        assert r.status_code == 400

    def test_operacoes_diferentes_nao_colidem(self, api, pessoas, imovel):
        criar(api, pessoas.cons, imovel, **assinado())
        criar(api, pessoas.cons, imovel, operacao=valor("operacoes", "Arrendamento").pk, **assinado())


class TestRenovacao:
    def test_renovar_cria_ciclo_e_preserva_original(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        fim = date.fromisoformat(c["data_fim"])
        r = como(api, pessoas.cons).post(
            detalhe(c["id"], "renovar"),
            {"forma": "documento", "data_inicio": str(fim + timedelta(days=1)), "prazo_meses": 6},
            format="json",
        )
        assert r.status_code == 201, r.content
        d = r.json()
        assert d["data_inicio"] == c["data_inicio"] and d["data_fim"] == c["data_fim"]  # original estável
        assert d["renovacoes"][0]["ciclo"] == 2
        assert d["data_fim_vigente"] == str(calcular_fim(fim + timedelta(days=1), 6))
        assert d["estado"] == "ativa"  # ainda no ciclo inicial
        assert RegistoAuditoria.objects.filter(acao="angariacao.renovada").exists()

    def test_renovacao_nao_pode_sobrepor_ciclo_atual(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        r = como(api, pessoas.cons).post(
            detalhe(c["id"], "renovar"), {"forma": "automatica", "data_inicio": c["data_fim"], "prazo_meses": 6}
        )
        assert r.status_code == 400

    def test_nao_renova_por_assinar(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel)
        r = como(api, pessoas.cons).post(
            detalhe(c["id"], "renovar"), {"forma": "automatica", "data_inicio": str(HOJE), "prazo_meses": 6}
        )
        assert r.status_code == 400

    def test_renovada_quando_no_novo_ciclo(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado(HOJE - timedelta(days=200), 6))
        fim = date.fromisoformat(c["data_fim"])
        r = como(api, pessoas.cons).post(
            detalhe(c["id"], "renovar"),
            {"forma": "automatica", "data_inicio": str(fim + timedelta(days=1)), "prazo_meses": 6},
        )
        assert r.json()["estado"] == "renovada"


class TestCorrecaoMaterial:
    def test_corrigir_exige_permissao_motivo_e_fica_registada(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        corpo = {"campo": "data_inicio", "valor": str(HOJE - timedelta(days=12)), "motivo": "Erro de digitação",
                 "evidencia": "https://onedrive.live.com/cmi.pdf"}  # fmt: skip
        # D-28: quem pode editar o CMI pode corrigir; quem não o vê, não.
        assert como(api, pessoas.cons2).post(detalhe(c["id"], "corrigir"), corpo).status_code == 404
        r = como(api, pessoas.cons).post(detalhe(c["id"], "corrigir"), corpo)
        assert r.status_code == 200, r.content
        d = r.json()
        assert d["data_inicio"] == str(HOJE - timedelta(days=12))
        assert d["data_fim"] == str(calcular_fim(HOJE - timedelta(days=12), 6))
        assert d["correcoes"][0]["motivo"] == "Erro de digitação"
        assert RegistoAuditoria.objects.filter(acao="angariacao.correcao_material").exists()

    def test_correcao_nao_pode_invadir_renovacao(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        fim = date.fromisoformat(c["data_fim"])
        como(api, pessoas.cons).post(
            detalhe(c["id"], "renovar"),
            {"forma": "automatica", "data_inicio": str(fim + timedelta(days=1)), "prazo_meses": 6},
        )
        r = como(api, pessoas.resp).post(
            detalhe(c["id"], "corrigir"), {"campo": "prazo_meses", "valor": "7", "motivo": "x", "evidencia": "y"}
        )
        assert r.status_code == 400 and "renovação" in str(r.json())

    def test_campos_obrigatorios(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        r = como(api, pessoas.resp).post(detalhe(c["id"], "corrigir"), {"campo": "prazo_meses", "valor": "7"})
        assert r.status_code == 400 and {"motivo", "evidencia"} <= set(r.json())


class TestRemuneracao:
    @pytest.mark.parametrize(
        "extra, ok",
        [
            ({"modalidade_remuneracao": "percentagem", "valor_remuneracao": "5"}, True),
            ({"modalidade_remuneracao": "valor_fixo", "valor_remuneracao": "7500"}, True),
            ({"modalidade_remuneracao": "numero_rendas", "valor_remuneracao": "2"}, False),  # venda
            ({"modalidade_remuneracao": "percentagem", "valor_remuneracao": "150"}, False),
            ({"valor_remuneracao": "5"}, False),
        ],
    )
    def test_modalidades_venda(self, api, pessoas, imovel, extra, ok):
        r = como(api, pessoas.cons).post(LISTA, {"imovel": imovel.pk, **extra}, format="json")
        assert (r.status_code == 201) is ok, r.content

    def test_arrendamento_percentagem_exige_base(self, api, pessoas, imovel):
        arr = valor("operacoes", "Arrendamento").pk
        corpo = {"imovel": imovel.pk, "operacao": arr, "modalidade_remuneracao": "percentagem_base",
                 "valor_remuneracao": "10"}  # fmt: skip
        assert como(api, pessoas.cons).post(LISTA, corpo, format="json").status_code == 400
        corpo["base_contratual"] = "Valor total das rendas do 1.º ano"
        assert como(api, pessoas.cons).post(LISTA, corpo, format="json").status_code == 201

    def test_zero_confirmado_distinto_de_desconhecido(self, api, pessoas, imovel):
        a = criar(api, pessoas.cons, imovel, modalidade_remuneracao="valor_fixo", valor_remuneracao="0")
        b = criar(api, pessoas.cons, imovel)
        assert a["valor_remuneracao"] == "0.0000" and b["valor_remuneracao"] is None


class TestAlertasEFiltros:
    def test_alerta_por_limiares(self, pessoas, imovel):
        a = Angariacao(imovel=imovel, responsavel=pessoas.cons, data_assinatura=HOJE, data_inicio=HOJE, prazo_meses=6)
        for dias, limiar in [(150, None), (100, 120), (45, 60), (10, 30)]:
            a.data_fim = a.data_fim_vigente = HOJE + timedelta(days=dias)
            assert (alerta(a) or {}).get("limiar") == limiar, dias

    def test_limiares_configuraveis(self, pessoas, imovel):
        Parametro.objects.filter(chave="cmi_alertas_dias").update(valor=[15])
        a = Angariacao(imovel=imovel, responsavel=pessoas.cons, data_assinatura=HOJE, data_inicio=HOJE, prazo_meses=6)
        a.data_fim = a.data_fim_vigente = HOJE + timedelta(days=20)
        assert alerta(a) is None

    def test_filtros_de_estado(self, api, pessoas, imovel):
        ne = valor("regimes_cmi", "Não exclusivo").pk
        por_assinar = criar(api, pessoas.cons, imovel, regime=ne)
        a_expirar = criar(api, pessoas.cons, imovel, regime=ne, **assinado(HOJE - timedelta(days=160), 6))
        expirada = criar(api, pessoas.cons, imovel, regime=ne, **assinado(HOJE - timedelta(days=400), 6))
        c = como(api, pessoas.cons)
        ids = lambda e: {x["id"] for x in c.get(LISTA, {"estado": e}).json()["results"]}  # noqa: E731
        assert ids("por_assinar") == {por_assinar["id"]}
        assert ids("a_expirar") == {a_expirar["id"]}
        assert ids("expiradas") == {expirada["id"]}
        assert a_expirar["id"] in ids("vigentes")

    def test_angariacoes_na_ficha_do_imovel(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        Angariacao.objects.create(imovel=imovel, responsavel=pessoas.cons2)  # de outro consultor
        r = como(api, pessoas.cons).get(reverse("imovel-angariacoes", args=[imovel.pk])).json()
        assert [x["id"] for x in r["angariacoes"]] == [c["id"]] and r["outros"] == 1


class TestPermissoesESituacao:
    def test_outro_consultor_nao_ve(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel)
        assert como(api, pessoas.cons2).get(detalhe(c["id"])).status_code == 404

    def test_imovel_sem_acesso(self, api, pessoas, imovel):
        r = como(api, pessoas.cons2).post(LISTA, {"imovel": imovel.pk}, format="json")
        assert r.status_code == 400

    def test_concluir_e_reabrir(self, api, pessoas, imovel):
        c = criar(api, pessoas.cons, imovel, **assinado())
        r = como(api, pessoas.cons).post(detalhe(c["id"], "situacao"), {"situacao": "concluida", "motivo": "Vendido"})
        assert r.json()["estado"] == "concluida"
        # D-28: o consultor responsável pode reabrir; a reabertura fica auditada.
        r = como(api, pessoas.cons).post(detalhe(c["id"], "situacao"), {"situacao": "em_curso", "motivo": "Desfeito"})
        assert r.status_code == 200 and r.json()["estado"] == "ativa"
        assert RegistoAuditoria.objects.filter(acao="angariacao.situacao", dados__para="em_curso").exists()
        # Quem não tem acesso ao CMI não reabre.
        assert (
            como(api, pessoas.cons2)
            .post(detalhe(c["id"], "situacao"), {"situacao": "concluida", "motivo": "x"})
            .status_code
            == 404
        )


def test_fotografia_do_imovel_na_lista_e_na_ficha(api, pessoas, imovel):
    c = criar(api, pessoas.cons, imovel)
    assert c["imovel_fotografia"] is None
    Imovel.objects.filter(pk=imovel.pk).update(fotografia="imoveis/x/foto.webp")
    lista = como(api, pessoas.cons).get(LISTA).json()["results"][0]
    assert lista["imovel_fotografia"] == {"imovel": imovel.pk, "versao": imovel.versao}
    assert como(api, pessoas.cons).get(detalhe(c["id"])).json()["imovel_fotografia"]["imovel"] == imovel.pk
