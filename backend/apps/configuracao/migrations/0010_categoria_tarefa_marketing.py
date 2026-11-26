"""D-53: as tarefas do Plano de Marketing de Imóveis têm uma categoria própria."""

from django.db import migrations

CATEGORIAS = [
    {"valor": "pos_venda", "nome": "Pós-venda (ligada a uma transação concluída)"},
    {"valor": "geral", "nome": "Geral"},
    {"valor": "marketing", "nome": "Marketing de imóveis (ligada a um plano)"},
]


def aplicar(apps, schema_editor):
    Lista = apps.get_model("configuracao", "Lista")
    ValorLista = apps.get_model("configuracao", "ValorLista")
    lista = Lista.objects.filter(chave="categorias_tarefa").first()
    if lista is None:
        return  # instalação nova: criada já com a categoria
    lista.categorias = CATEGORIAS
    lista.save(update_fields=["categorias"])
    if not ValorLista.objects.filter(lista=lista, categoria="marketing").exists():
        ordem = ValorLista.objects.filter(lista=lista).count()
        ValorLista.objects.create(lista=lista, nome="Marketing de imóveis", categoria="marketing", ordem=ordem)


class Migration(migrations.Migration):
    dependencies = [("configuracao", "0009_momentos_pagamento_categorias")]
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
