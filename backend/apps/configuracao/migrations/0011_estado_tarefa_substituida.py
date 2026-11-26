"""D-54: estado das tarefas pendentes encerradas por um novo ciclo de marketing (Cap. 19)."""

from django.db import migrations

CATEGORIAS = [
    {"valor": "aberta", "nome": "Por fazer"},
    {"valor": "em_curso", "nome": "Em curso"},
    {"valor": "concluida", "nome": "Concluída"},
    {"valor": "cancelada", "nome": "Cancelada"},
    {"valor": "substituida", "nome": "Não executada — plano substituído (só o CRM a usa, num novo ciclo)"},
]


def aplicar(apps, schema_editor):
    Lista = apps.get_model("configuracao", "Lista")
    ValorLista = apps.get_model("configuracao", "ValorLista")
    lista = Lista.objects.filter(chave="estados_tarefa").first()
    if lista is None:
        return
    lista.categorias = CATEGORIAS
    lista.save(update_fields=["categorias"])
    if not ValorLista.objects.filter(lista=lista, categoria="substituida").exists():
        ordem = ValorLista.objects.filter(lista=lista).count()
        ValorLista.objects.create(
            lista=lista, nome="Não executada — Plano substituído", categoria="substituida", ordem=ordem
        )


class Migration(migrations.Migration):
    dependencies = [("configuracao", "0010_categoria_tarefa_marketing")]
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
