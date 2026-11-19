"""D-35: os lugares de estacionamento passam a vir da «Garagem».

Migração só de dados, separada da 0006: no PostgreSQL não se pode criar um índice na mesma transação em
que se alteram chaves estrangeiras dessa tabela («pending trigger events»).
"""

from django.db import migrations


def lugares_para_garagem(apps, schema_editor):
    """D-35: os lugares de estacionamento passam a vir da «Garagem». Converte os já registados."""
    Imovel = apps.get_model("imoveis", "Imovel")
    Valor = apps.get_model("configuracao", "ValorLista")
    nomes = {1: "1 lugar", 2: "2 lugares", 3: "3 lugares", 4: "4 lugares", 5: "5 lugares"}
    for i in Imovel.objects.filter(garagem__isnull=True, lugares_estacionamento__gt=0):
        valor = Valor.objects.filter(lista__chave="garagens", nome=nomes.get(min(i.lugares_estacionamento, 5))).first()
        if valor:
            Imovel.objects.filter(pk=i.pk).update(garagem=valor)


class Migration(migrations.Migration):
    dependencies = [
        ("configuracao", "0005_listas_d34"),
        ("imoveis", "0006_d35_campos"),
    ]

    operations = [migrations.RunPython(lugares_para_garagem, migrations.RunPython.noop)]
