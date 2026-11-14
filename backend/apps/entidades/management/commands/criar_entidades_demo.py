"""Cria entidades FICTÍCIAS para demonstração. Recusa-se a correr em produção.

Nomes inventados, emails em example.com (domínio reservado) e sem NIF, para não
coincidir com dados de pessoas reais.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.contas.models import Utilizador
from apps.entidades.models import Entidade, OrigemContacto, PapelEntidade, TelefoneEntidade

DEMO = [
    ("singular", "Ana", "Demonstração Costa", ["Proprietário", "Vendedor"], "consultor"),
    ("singular", "Bruno", "Exemplo Martins", ["Comprador"], "consultor"),
    ("singular", "Carla", "Fictícia Sousa", ["Arrendatário"], "consultor"),
    ("singular", "Duarte", "Ensaio Ferreira", ["Comprador", "Proprietário"], "consultor"),
    ("coletiva", "Construções Demonstração, Lda.", "", ["Contacto profissional"], "consultor"),
    ("singular", "Eva", "Modelo Rodrigues", ["Senhorio"], "assistente"),
    ("singular", "Filipe", "Teste Almeida", ["Comprador"], "responsavel"),
    ("coletiva", "Investimentos Fictícios, S.A.", "", ["Comprador"], "responsavel"),
]


class Command(BaseCommand):
    help = "Cria entidades fictícias de demonstração (requer criar_utilizadores_demo)."

    def handle(self, *args, **opts):
        if settings.CRM_AMBIENTE == "producao":
            raise CommandError("Não é permitido criar dados demo em produção.")
        origem, _ = OrigemContacto.objects.get_or_create(nome="Recomendação (demo)")
        for i, (tipo, nome, apelido, papeis, quem) in enumerate(DEMO, start=1):
            responsavel = Utilizador.objects.get(email=f"{quem}@demo.local")
            e, criada = Entidade.objects.get_or_create(
                nome=nome,
                apelido=apelido,
                defaults={
                    "tipo_pessoa": tipo,
                    "email": f"demo{i}@example.com",
                    "responsavel": responsavel,
                    "criado_por": responsavel,
                    "atualizado_por": responsavel,
                    "origem": origem,
                    "localidade": "Localidade Demo",
                },
            )
            if criada:
                e.papeis.set(PapelEntidade.objects.filter(nome__in=papeis))
                TelefoneEntidade.objects.create(
                    entidade=e, regiao="PT", numero=f"91200{i:04d}", numero_e164=f"+35191200{i:04d}", principal=True
                )
            self.stdout.write(f"{'Criada' if criada else 'Existente'}: {e.referencia} {e.nome_completo}")
