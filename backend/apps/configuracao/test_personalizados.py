"""Campos personalizados (D-44): criados pelo Administrador, validados no servidor, sem alterar a base de dados."""

import pytest
from django.urls import reverse

from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria
from apps.imoveis.models import Imovel

pytestmark = pytest.mark.django_db

CAMPOS = reverse("campos-personalizados")


def entidade(**extra):
    base = {"tipo_pessoa": "singular", "nome": "Rita", "apelido": "Ensaio", "nif": "123456789"}
    base.update(extra)
    return base


def criar_campo(api, **dados):
    r = api.post(CAMPOS, {"ecra": "entidades", **dados}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


@pytest.fixture
def pessoas(criar_utilizador, equipa_norte, equipa_sul):
    class P:
        admin = criar_utilizador(Perfil.ADMINISTRADOR)
        cons = criar_utilizador(Perfil.CONSULTOR, equipa_norte)
        cons_sul = criar_utilizador(Perfil.CONSULTOR, equipa_sul)

    return P


def test_so_o_administrador_cria_campos(api, pessoas):
    api.force_authenticate(pessoas.cons)
    assert api.post(CAMPOS, {"ecra": "entidades", "nome": "Hobby", "tipo": "texto"}, format="json").status_code == 403
    api.force_authenticate(pessoas.admin)
    c = criar_campo(api, nome="Clube de futebol", tipo="texto")
    assert c["chave"] == "cp_clube_de_futebol"
    # O mesmo nome gera outra chave; o nome pode mudar, a chave não.
    assert criar_campo(api, nome="Clube de futebol", tipo="texto")["chave"] == "cp_clube_de_futebol_2"
    r = api.patch(reverse("campo-personalizado", args=[c["id"]]), {"nome": "Clube"}, format="json")
    assert r.json()["nome"] == "Clube" and r.json()["chave"] == "cp_clube_de_futebol"
    assert RegistoAuditoria.objects.filter(acao="campo_personalizado.alterado").exists()
    api.force_authenticate(pessoas.cons)
    lista = api.get(CAMPOS, {"ecra": "entidades"}).json()
    assert [x["nome"] for x in lista["campos"]] == ["Clube", "Clube de futebol"]
    assert "em_uso" not in lista["campos"][0]


def test_valores_validados_por_tipo_e_guardados_no_registo(api, pessoas):
    api.force_authenticate(pessoas.admin)
    numero = criar_campo(api, nome="Filhos", tipo="inteiro", obrigatorio=True)
    valor = criar_campo(api, nome="Poupanças", tipo="moeda")
    data = criar_campo(api, nome="Data do casamento", tipo="data")
    sim = criar_campo(api, nome="Tem animais", tipo="sim_nao")
    tel = criar_campo(api, nome="Telefone do trabalho", tipo="telefone")
    lista = criar_campo(api, nome="Desporto", tipo="lista_multipla")
    # As opções vêm de uma lista configurável criada com o campo (D-34).
    r = api.post(reverse("listas-adicionar", args=[lista["lista"]]), {"nome": "Ténis"}, format="json")
    tenis = next(v["id"] for v in r.json()["valores"] if v["nome"] == "Ténis")
    api.force_authenticate(pessoas.cons)
    r = api.post(reverse("entidade-list"), entidade(), format="json")
    assert r.status_code == 400 and numero["chave"] in r.json()  # obrigatório
    maus = {numero["chave"]: "dois", valor["chave"]: "x", data["chave"]: "31-02-2026", tel["chave"]: "123"}
    r = api.post(reverse("entidade-list"), entidade(campos_personalizados=maus), format="json")
    assert set(r.json()) >= set(maus)
    bons = {
        numero["chave"]: "2",
        valor["chave"]: "1500,5",
        data["chave"]: "2020-06-13",
        sim["chave"]: True,
        tel["chave"]: "912 345 678",
        lista["chave"]: [tenis],
    }
    r = api.post(reverse("entidade-list"), entidade(campos_personalizados=bons), format="json")
    assert r.status_code == 201, r.content
    cp = r.json()["campos_personalizados"]
    assert cp == {
        numero["chave"]: 2,
        valor["chave"]: "1500.50",
        data["chave"]: "2020-06-13",
        sim["chave"]: True,
        tel["chave"]: "+351912345678",
        lista["chave"]: [tenis],
    }
    assert r.json()["campos_personalizados_nomes"][lista["chave"]][0]["titulo"] == "Ténis"
    # Campos desconhecidos são recusados (não se pode gravar o que o Administrador não criou).
    pk = r.json()["id"]
    url = reverse("entidade-detail", args=[pk])
    r2 = api.patch(url, {"versao": r.json()["versao"], "campos_personalizados": {"cp_inventado": 1}}, format="json")
    assert r2.status_code == 400
    # Editar sem enviar os campos personalizados mantém-nos; apagar um valor fica no histórico.
    r3 = api.patch(url, {"versao": r.json()["versao"], "cargo": "Gestora"}, format="json")
    assert r3.json()["campos_personalizados"] == cp
    r4 = api.patch(url, {"versao": r3.json()["versao"], "campos_personalizados": {valor["chave"]: ""}}, format="json")
    assert valor["chave"] not in r4.json()["campos_personalizados"]
    historico = api.get(reverse("entidade-historico", args=[pk])).json()
    assert {"campo": "Poupanças", "antes": "1500.50", "depois": None} in historico[0]["alteracoes"]


def test_relacao_so_com_registos_acessiveis(api, pessoas):
    api.force_authenticate(pessoas.admin)
    rel = criar_campo(api, nome="Imóvel de férias", tipo="relacao", modulo_relacao="imoveis")
    assert api.post(CAMPOS, {"ecra": "entidades", "nome": "X", "tipo": "relacao"}, format="json").status_code == 400
    meu = Imovel.objects.create(responsavel=pessoas.cons, localidade="Ensaio")
    alheio = Imovel.objects.create(responsavel=pessoas.cons_sul, localidade="Outra")
    api.force_authenticate(pessoas.cons)
    procura = api.get(reverse("campos-personalizados-procurar"), {"ecra": "imoveis", "q": "IMO"}).json()
    assert [x["id"] for x in procura] == [meu.pk]
    r = api.post(reverse("entidade-list"), entidade(campos_personalizados={rel["chave"]: alheio.pk}), format="json")
    assert r.status_code == 400
    r = api.post(reverse("entidade-list"), entidade(campos_personalizados={rel["chave"]: meu.pk}), format="json")
    assert r.status_code == 201
    assert r.json()["campos_personalizados_nomes"][rel["chave"]][0]["titulo"].startswith(meu.referencia)


def test_remover_so_sem_dados_senao_desativar(api, pessoas):
    api.force_authenticate(pessoas.admin)
    c = criar_campo(api, nome="Hobby", tipo="texto")
    vazio = criar_campo(api, nome="Sem uso", tipo="lista")
    r = api.post(reverse("entidade-list"), entidade(campos_personalizados={c["chave"]: "Pesca"}), format="json")
    pk, versao = r.json()["id"], r.json()["versao"]
    url = reverse("campo-personalizado", args=[c["id"]])
    r = api.delete(url)
    assert r.status_code == 409 and r.json()["em_uso"] == 1
    assert api.delete(reverse("campo-personalizado", args=[vazio["id"]])).status_code == 204
    # Desativado: deixa de se poder alterar, mas o valor guardado mantém-se.
    api.patch(url, {"ativo": False}, format="json")
    r = api.patch(
        reverse("entidade-detail", args=[pk]),
        {"versao": versao, "campos_personalizados": {c["chave"]: "Outro"}},
        format="json",
    )
    assert r.status_code == 200 and r.json()["campos_personalizados"][c["chave"]] == "Pesca"


def test_campos_personalizados_em_todos_os_modulos(api, pessoas):
    """Os campos funcionam em qualquer módulo com registos (aqui: imóveis)."""
    api.force_authenticate(pessoas.admin)
    c = api.post(CAMPOS, {"ecra": "imoveis", "nome": "Vista mar", "tipo": "sim_nao"}, format="json").json()
    api.force_authenticate(pessoas.cons)
    i = Imovel.objects.create(responsavel=pessoas.cons)
    url = reverse("imovel-detail", args=[i.pk])
    r = api.patch(url, {"versao": i.versao, "campos_personalizados": {c["chave"]: "sim"}}, format="json")
    assert r.status_code == 200, r.content
    assert api.get(url).json()["campos_personalizados"] == {c["chave"]: True}


def test_nomes_alterados_na_disposicao(api, pessoas):
    url = reverse("disposicao", args=["entidades"])
    api.force_authenticate(pessoas.admin)
    blocos = [{"chave": "identificacao", "titulo": "Quem é", "campos": ["nome"]}]
    r = api.put(url, {"blocos": blocos, "rotulos": {"nome": "Primeiro nome", "nif": " "}}, format="json")
    assert r.status_code == 200 and r.json()["rotulos"] == {"nome": "Primeiro nome"}
    assert api.put(url, {"blocos": blocos, "rotulos": {"nome": "x" * 81}}, format="json").status_code == 400
    api.force_authenticate(pessoas.cons)
    assert api.get(url).json()["rotulos"] == {"nome": "Primeiro nome"}
