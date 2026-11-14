from django.contrib.postgres.operations import TrigramExtension, UnaccentExtension
from django.db import migrations

# Papéis enumerados na Especificação (§10/Cap. 5). Outros podem ser criados no admin.
PAPEIS = ["Proprietário", "Comprador", "Vendedor", "Arrendatário", "Senhorio", "Contacto profissional"]


def criar_papeis(apps, schema_editor):
    Papel = apps.get_model("entidades", "PapelEntidade")
    for ordem, nome in enumerate(PAPEIS):
        Papel.objects.get_or_create(nome=nome, defaults={"ordem": ordem})


class Migration(migrations.Migration):
    dependencies = [("entidades", "0001_initial")]

    operations = [
        UnaccentExtension(),
        TrigramExtension(),
        migrations.RunPython(criar_papeis, migrations.RunPython.noop),
    ]
