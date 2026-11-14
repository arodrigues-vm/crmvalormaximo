"""Cria utilizadores FICTÍCIOS, um por perfil, para desenvolvimento e verificações.

Recusa-se a correr no ambiente de produção.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.contas.models import Equipa, Perfil, Utilizador

DEMO = [
    ("admin@demo.local", "Administrador Demo", Perfil.ADMINISTRADOR),
    ("responsavel@demo.local", "Responsável Demo", Perfil.RESPONSAVEL),
    ("consultor@demo.local", "Consultor Demo", Perfil.CONSULTOR),
    ("assistente@demo.local", "Assistente Demo", Perfil.ASSISTENTE),
]


class Command(BaseCommand):
    help = "Cria utilizadores fictícios (um por perfil) para desenvolvimento."

    def add_arguments(self, parser):
        parser.add_argument("--password", required=True, help="Palavra-passe comum aos utilizadores demo.")

    def handle(self, *args, password, **options):
        if settings.CRM_AMBIENTE == "producao":
            raise CommandError("Não é permitido criar utilizadores demo em produção.")
        equipa, _ = Equipa.objects.get_or_create(nome="Equipa Demo")
        for email, nome, perfil in DEMO:
            u, criado = Utilizador.objects.get_or_create(
                email=email, defaults={"nome": nome, "perfil": perfil, "equipa": equipa}
            )
            if perfil == Perfil.ADMINISTRADOR:
                u.is_staff = True
            u.set_password(password)
            u.save()
            self.stdout.write(f"{'Criado' if criado else 'Atualizado'}: {email} ({u.get_perfil_display()})")
