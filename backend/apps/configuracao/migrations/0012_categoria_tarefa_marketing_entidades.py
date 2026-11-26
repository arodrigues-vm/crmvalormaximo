"""D-55: as tarefas dos planos de Marketing de Entidades têm uma categoria própria."""

from django.db import migrations

CATEGORIAS = [
    {"valor": "pos_venda", "nome": "Pós-venda (ligada a uma transação concluída)"},
    {"valor": "geral", "nome": "Geral"},
    {"valor": "marketing", "nome": "Marketing de imóveis (ligada a um plano)"},
    {"valor": "marketing_entidades", "nome": "Marketing de entidades (ligada a um plano de entidades)"},
]


def aplicar(apps, schema_editor):
    Lista = apps.get_model("configuracao", "Lista")
    ValorLista = apps.get_model("configuracao", "ValorLista")
    lista = Lista.objects.filter(chave="categorias_tarefa").first()
    if lista is None:
        return
    lista.categorias = CATEGORIAS
    lista.save(update_fields=["categorias"])
    if not ValorLista.objects.filter(lista=lista, categoria="marketing_entidades").exists():
        ordem = ValorLista.objects.filter(lista=lista).count()
        ValorLista.objects.create(lista=lista, nome="Marketing de entidades", categoria="marketing_entidades", ordem=ordem)


class Migration(migrations.Migration):
    dependencies = [("configuracao", "0011_estado_tarefa_substituida")]
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
