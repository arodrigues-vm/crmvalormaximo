from django.db import migrations

# Tipos indicados pelo proprietário (14/11/2026). Outros criam-se no admin.
TIPOS = [
    ("Cônjuge", "Cônjuge", True),
    ("Familiar", "Familiar", True),
    ("Sócio de", "Tem como sócio", False),
    ("Gerente de", "Tem como gerente", False),
]


def criar(apps, schema_editor):
    Tipo = apps.get_model("entidades", "TipoRelacao")
    for ordem, (nome, inverso, simetrica) in enumerate(TIPOS):
        Tipo.objects.get_or_create(
            nome=nome, defaults={"nome_inverso": inverso, "simetrica": simetrica, "ordem": ordem}
        )


class Migration(migrations.Migration):
    dependencies = [("entidades", "0003_relacoes")]
    operations = [migrations.RunPython(criar, migrations.RunPython.noop)]
