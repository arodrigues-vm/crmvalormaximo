import pytest
from django.core.management import call_command
from django.urls import reverse

from apps.contas.models import Perfil
from apps.localizacao.models import Concelho, Distrito, Freguesia

# Dados FICTÍCIOS apenas para testar o importador (códigos e nomes inventados).
CSV = """dicofre;freguesia;concelho;distrito
990101;Freguesia Ensaio A;Concelho Ensaio;Distrito Ensaio
990102;Freguesia Ensaio B;Concelho Ensaio;Distrito Ensaio
310101;Freguesia Ilha;Concelho Ilha;Região Ensaio
"""


@pytest.fixture
def ficheiro(tmp_path):
    f = tmp_path / "caop.csv"
    f.write_text(CSV, encoding="utf-8")
    return f


@pytest.mark.django_db
def test_importar_caop_idempotente(ficheiro):
    call_command("importar_caop", ficheiro)
    call_command("importar_caop", ficheiro)
    assert Distrito.objects.count() == 2
    assert Concelho.objects.count() == 2
    assert Freguesia.objects.count() == 3
    assert Distrito.objects.get(codigo="31").regiao_autonoma
    assert not Distrito.objects.get(codigo="99").regiao_autonoma


@pytest.mark.django_db
def test_marcar_inativas_preserva_registos(ficheiro, tmp_path):
    call_command("importar_caop", ficheiro)
    menor = tmp_path / "menor.csv"
    menor.write_text("\n".join(CSV.splitlines()[:2]) + "\n", encoding="utf-8")
    call_command("importar_caop", menor, "--marcar-inativas")
    assert Freguesia.objects.count() == 3
    assert Freguesia.objects.filter(ativa=True).count() == 1


@pytest.mark.django_db
def test_api_hierarquia_e_pesquisa(ficheiro, api, criar_utilizador):
    call_command("importar_caop", ficheiro)
    api.force_authenticate(criar_utilizador(Perfil.CONSULTOR))
    d = api.get(reverse("distritos")).json()
    ensaio = next(x for x in d if x["codigo"] == "99")
    c = api.get(reverse("concelhos"), {"distrito": ensaio["id"]}).json()
    assert [x["nome"] for x in c] == ["Concelho Ensaio"]
    f = api.get(reverse("freguesias"), {"concelho": c[0]["id"]}).json()
    assert len(f) == 2
    assert api.get(reverse("concelhos"), {"pesquisa": "ensaio"}).json()[0]["distrito"] == "Distrito Ensaio"
    pesquisa = api.get(reverse("freguesias"), {"pesquisa": "ilha"}).json()
    assert pesquisa[0]["distrito"] == "Região Ensaio"
