import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("configuracao", "0001_initial"),
        ("entidades", "0005_listas_configuraveis"),
    ]

    operations = [
        migrations.RemoveField(model_name="entidade", name="papeis"),
        migrations.RemoveField(model_name="entidade", name="origem"),
        migrations.RemoveField(model_name="historicalentidade", name="origem"),
        migrations.DeleteModel(name="PapelEntidade"),
        migrations.DeleteModel(name="OrigemContacto"),
        migrations.RenameField(model_name="entidade", old_name="papeis_v", new_name="papeis"),
        migrations.RenameField(model_name="entidade", old_name="origem_v", new_name="origem"),
        migrations.RenameField(model_name="historicalentidade", old_name="origem_v", new_name="origem"),
    ]
