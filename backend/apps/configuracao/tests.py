import pytest
from django.urls import reverse

from apps.configuracao.models import ValorLista
from apps.contas.models import Perfil
from apps.core.models import RegistoAuditoria

pytestmark = pytest.mark.django_db


def lista(resposta, chave):
    return next(x for x in resposta.json() if x["chave"] == chave)


def test_listas_iniciais(api, criar_utilizador):
    api.force_authenticate(criar_utilizador(Perfil.CONSULTOR))
    r = api.get(reverse("listas"))
    nomes = [v["nome"] for v in lista(r, "estados_comercializacao")["valores"]]
    assert nomes == ["Em preparação", "Disponível", "Reservado", "Vendido", "Arrendado", "Retirado"]
    assert [v["nome"] for v in lista(r, "tipologias")["valores"]][0] == "T0"
    assert lista(r, "zonas_comerciais")["valores"] == []


def test_so_administrador_altera(api, criar_utilizador):
    api.force_authenticate(criar_utilizador(Perfil.RESPONSAVEL))
    r = api.post(reverse("listas-adicionar", args=["tipologias"]), {"nome": "T7"}, format="json")
    assert r.status_code == 403


def test_adicionar_renomear_desativar_e_ordenar(api, criar_utilizador):
    api.force_authenticate(criar_utilizador(Perfil.ADMINISTRADOR))
    r = api.post(reverse("listas-adicionar", args=["zonas_comerciais"]), {"nome": "Centro"}, format="json")
    assert r.status_code == 201
    api.post(reverse("listas-adicionar", args=["zonas_comerciais"]), {"nome": "Litoral"}, format="json")
    duplicado = api.post(reverse("listas-adicionar", args=["zonas_comerciais"]), {"nome": "centro"}, format="json")
    assert duplicado.status_code == 400
    centro = ValorLista.objects.get(nome="Centro")
    r = api.patch(
        reverse("listas-valor", args=[centro.pk]), {"nome": "Centro histórico", "ativo": False}, format="json"
    )
    assert r.status_code == 200
    centro.refresh_from_db()
    assert centro.nome == "Centro histórico" and not centro.ativo
    litoral = ValorLista.objects.get(nome="Litoral")
    r = api.post(reverse("listas-ordenar", args=["zonas_comerciais"]), {"ids": [litoral.pk, centro.pk]}, format="json")
    assert [v["nome"] for v in r.json()["valores"]] == ["Litoral", "Centro histórico"]
    assert RegistoAuditoria.objects.filter(acao="lista.valor_alterado").exists()


def test_valor_desativado_nao_aparece_a_quem_nao_administra(api, criar_utilizador):
    v = ValorLista.objects.get(lista__chave="tipologias", nome="T0")
    v.ativo = False
    v.save()
    api.force_authenticate(criar_utilizador(Perfil.CONSULTOR))
    assert "T0" not in [x["nome"] for x in lista(api.get(reverse("listas")), "tipologias")["valores"]]


def test_valor_desativado_mantem_se_no_registo_mas_nao_pode_ser_escolhido(api, criar_utilizador):
    from apps.entidades.models import Entidade

    u = criar_utilizador(Perfil.CONSULTOR)
    api.force_authenticate(u)
    comprador = ValorLista.objects.get(lista__chave="papeis_entidade", nome="Comprador")
    vendedor = ValorLista.objects.get(lista__chave="papeis_entidade", nome="Vendedor")
    e = api.post(reverse("entidade-list"), {"nome": "Ensaio", "papeis": [comprador.pk]}, format="json").json()
    comprador.ativo = vendedor.ativo = False
    comprador.save()
    vendedor.save()
    ok = api.patch(reverse("entidade-detail", args=[e["id"]]), {"versao": 1, "papeis": [comprador.pk]}, format="json")
    assert ok.status_code == 200
    novo = api.patch(reverse("entidade-detail", args=[e["id"]]), {"versao": 2, "papeis": [vendedor.pk]}, format="json")
    assert novo.status_code == 400
    assert list(Entidade.objects.get(pk=e["id"]).papeis.values_list("nome", flat=True)) == ["Comprador"]


def test_lista_com_categorias_exige_categoria_fixa(api, criar_utilizador):
    api.force_authenticate(criar_utilizador(Perfil.ADMINISTRADOR))
    url = reverse("listas-adicionar", args=["operacoes"])
    assert api.post(url, {"nome": "Venda em leilão"}, format="json").status_code == 400
    assert api.post(url, {"nome": "Venda em leilão", "categoria": "troca"}, format="json").status_code == 400
    r = api.post(url, {"nome": "Venda em leilão", "categoria": "venda"}, format="json")
    assert r.status_code == 201
    assert {"nome": "Venda em leilão", "categoria": "venda"}.items() <= r.json()["valores"][-1].items()
    assert [c["valor"] for c in r.json()["categorias"]] == ["venda", "arrendamento"]


def test_categoria_nao_muda_ao_renomear(api, criar_utilizador):
    api.force_authenticate(criar_utilizador(Perfil.ADMINISTRADOR))
    v = ValorLista.objects.get(lista__chave="status_imovel", nome="Arquivado")
    r = api.patch(reverse("listas-valor", args=[v.pk]), {"nome": "Histórico", "categoria": "ativo"}, format="json")
    assert r.status_code == 400
    api.patch(reverse("listas-valor", args=[v.pk]), {"nome": "Histórico"}, format="json")
    v.refresh_from_db()
    assert (v.nome, v.categoria) == ("Histórico", "arquivado")


def test_valor_sem_categoria_pode_receber_categoria_uma_vez(api, criar_utilizador):
    api.force_authenticate(criar_utilizador(Perfil.ADMINISTRADOR))
    v = ValorLista.objects.get(lista__chave="estados_comercializacao", nome="Disponível")
    v.categoria = ""
    v.save()
    url = reverse("listas-valor", args=[v.pk])
    assert api.patch(url, {"categoria": "inexistente"}, format="json").status_code == 400
    assert api.patch(url, {"categoria": "disponivel"}, format="json").status_code == 200
    assert api.patch(url, {"categoria": "reservado"}, format="json").status_code == 400


def test_todas_as_listas_com_categorias_tem_valores_categorizados(db):
    from apps.configuracao.listas_sistema import CATEGORIAS, LISTAS, semear_listas
    from apps.configuracao.models import Lista

    semear_listas()
    for chave in CATEGORIAS:
        lista = Lista.objects.get(chave=chave)
        validas = {c["valor"] for c in lista.categorias}
        assert validas, chave
        assert lista.valores.count() == len(LISTAS[chave][3])
        assert all(v.categoria in validas for v in lista.valores.all()), chave


def test_parametros_iniciais(db):
    from apps.configuracao.models import parametro

    assert parametro("cmi_alertas_dias") == [120, 60, 30]


def test_parametros_editaveis_so_pelo_administrador(api, criar_utilizador):
    api.force_authenticate(criar_utilizador(Perfil.RESPONSAVEL))
    assert api.get(reverse("parametros")).status_code == 200
    url = reverse("parametro", args=["cmi_alertas_dias"])
    assert api.patch(url, {"valor": [90, 30]}, format="json").status_code == 403
    api.force_authenticate(criar_utilizador(Perfil.ADMINISTRADOR))
    r = api.patch(url, {"valor": [30, "90", 30]}, format="json")
    assert r.status_code == 200 and r.json()["valor"] == [90, 30]
    for invalido in ([], [0], ["x"], [1, 2, 3, 4, 5, 6], "120"):
        assert api.patch(url, {"valor": invalido}, format="json").status_code == 400, invalido
    assert RegistoAuditoria.objects.filter(acao="parametro.alterado").exists()
