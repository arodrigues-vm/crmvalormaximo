from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("imoveis", "0002_operacao_status_listas")]

    operations = [
        migrations.RemoveField(model_name="imovel", name="operacao"),
        migrations.RemoveField(model_name="imovel", name="status"),
        migrations.RemoveField(model_name="historicalimovel", name="operacao"),
        migrations.RemoveField(model_name="historicalimovel", name="status"),
        migrations.RenameField(model_name="imovel", old_name="operacao_v", new_name="operacao"),
        migrations.RenameField(model_name="imovel", old_name="status_v", new_name="status"),
        migrations.RenameField(model_name="historicalimovel", old_name="operacao_v", new_name="operacao"),
        migrations.RenameField(model_name="historicalimovel", old_name="status_v", new_name="status"),
    ]
