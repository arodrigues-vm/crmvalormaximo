"""D-49: os momentos de pagamento da comissão ganham categoria (para propor as prestações sem ler nomes)."""

from django.db import migrations

CATEGORIAS = [
    {"valor": "cpcv_100", "nome": "100% no CPCV"},
    {"valor": "cpcv_50", "nome": "50% no CPCV e 50% na escritura"},
    {"valor": "escritura_100", "nome": "100% na escritura"},
]
POR_NOME = {
    "100% no CPCV": "cpcv_100",
    "50% no CPCV e 50% na escritura": "cpcv_50",
    "100% na escritura": "escritura_100",
}


def aplicar(apps, schema_editor):
    Lista = apps.get_model("configuracao", "Lista")
    ValorLista = apps.get_model("configuracao", "ValorLista")
    lista = Lista.objects.filter(chave="momentos_pagamento_comissao").first()
    if lista is None:
        return  # instalação nova: criada já com categorias
    lista.categorias = CATEGORIAS
    lista.save(update_fields=["categorias"])
    for nome, cat in POR_NOME.items():
        ValorLista.objects.filter(lista=lista, nome=nome, categoria="").update(categoria=cat)


class Migration(migrations.Migration):
    dependencies = [("configuracao", "0008_tipo_cliente_externo")]
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
