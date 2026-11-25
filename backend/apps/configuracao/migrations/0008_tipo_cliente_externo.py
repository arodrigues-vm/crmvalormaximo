"""D-46: «Tipo de cliente» passa a ter categorias; acrescenta o valor «Cliente externo»."""

from django.db import migrations

CATEGORIAS = [
    {"valor": "geral", "nome": "Tipo de cliente"},
    {"valor": "cliente_externo", "nome": "Cliente externo (responsável escolhido em Agentes)"},
]


def aplicar(apps, schema_editor):
    Lista = apps.get_model("configuracao", "Lista")
    ValorLista = apps.get_model("configuracao", "ValorLista")
    lista, _ = Lista.objects.get_or_create(
        chave="papeis_entidade",
        defaults={"nome": "Tipos de cliente", "modulo": "entidades", "descricao": "Proprietário, comprador, arrendatário…"},
    )
    lista.categorias = CATEGORIAS
    lista.save(update_fields=["categorias"])
    ValorLista.objects.filter(lista=lista, categoria="").update(categoria="geral")
    externo = ValorLista.objects.filter(lista=lista, nome="Cliente externo").first()
    if externo:
        externo.categoria = "cliente_externo"
        externo.save(update_fields=["categoria"])
    else:
        ultimo = ValorLista.objects.filter(lista=lista).order_by("-ordem").values_list("ordem", flat=True).first() or 0
        ValorLista.objects.create(lista=lista, nome="Cliente externo", categoria="cliente_externo", ordem=ultimo + 1)


class Migration(migrations.Migration):
    dependencies = [("configuracao", "0007_disposicao_rotulos_historicaldisposicao_rotulos_and_more")]
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
