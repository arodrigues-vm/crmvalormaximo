"""D-38: o Consultor passa a poder criar e editar (os seus) agentes e agências.

Só altera linhas que ainda estão em «nenhum» (valor por omissão anterior): não sobrepõe alterações
feitas pelo Administrador."""

from django.db import migrations


def aplicar(apps, schema_editor):
    PermissaoPerfil = apps.get_model("contas", "PermissaoPerfil")
    PermissaoPerfil.objects.filter(
        perfil="consultor", modulo__in=["agentes", "agencias"], operacao__in=["criar", "editar"], ambito="nenhum"
    ).update(ambito="atribuidos")


class Migration(migrations.Migration):
    dependencies = [("contas", "0002_mfa")]

    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
