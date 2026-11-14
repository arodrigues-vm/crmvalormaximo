"""Importa a CAOP a partir de um CSV com as colunas:

    dicofre;freguesia;concelho;distrito

(separador `;` ou `,`, UTF-8). Os códigos DI e DICO derivam do DICOFRE
(DI = 2 primeiros dígitos, DICO = 4 primeiros). Distritos 31/32 (Madeira) e
41–49 (Açores) são marcados como Região Autónoma.

É idempotente: atualiza nomes e cria em falta; nunca apaga. Freguesias que
deixem de constar do ficheiro são marcadas como inativas (preservação histórica)
apenas com --marcar-inativas.
"""

import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.localizacao.models import Concelho, Distrito, Freguesia


def _regiao_autonoma(di: str) -> bool:
    return di in ("31", "32") or di.startswith("4")


class Command(BaseCommand):
    help = "Importa distritos, concelhos e freguesias a partir de um CSV da CAOP."

    def add_arguments(self, parser):
        parser.add_argument("ficheiro", type=Path)
        parser.add_argument("--marcar-inativas", action="store_true")

    @transaction.atomic
    def handle(self, ficheiro: Path, marcar_inativas: bool, **opts):
        if not ficheiro.exists():
            raise CommandError(f"Ficheiro não encontrado: {ficheiro}")
        texto = ficheiro.read_text(encoding="utf-8-sig")
        dialeto = csv.Sniffer().sniff(texto.splitlines()[0], delimiters=";,")
        linhas = list(csv.DictReader(texto.splitlines(), dialect=dialeto))
        obrigatorias = {"dicofre", "freguesia", "concelho", "distrito"}
        if not linhas or not obrigatorias <= {c.strip().lower() for c in linhas[0]}:
            raise CommandError(f"Colunas obrigatórias: {', '.join(sorted(obrigatorias))}")

        vistos = set()
        contagem = {"distritos": 0, "concelhos": 0, "freguesias": 0}
        for bruta in linhas:
            linha = {k.strip().lower(): (v or "").strip() for k, v in bruta.items()}
            dicofre = linha["dicofre"].zfill(6)
            if not dicofre.isdigit() or len(dicofre) != 6:
                raise CommandError(f"DICOFRE inválido: {linha['dicofre']!r}")
            di, dico = dicofre[:2], dicofre[:4]
            d, criado = Distrito.objects.update_or_create(
                codigo=di, defaults={"nome": linha["distrito"], "regiao_autonoma": _regiao_autonoma(di)}
            )
            contagem["distritos"] += criado
            c, criado = Concelho.objects.update_or_create(
                codigo=dico, defaults={"nome": linha["concelho"], "distrito": d}
            )
            contagem["concelhos"] += criado
            _, criado = Freguesia.objects.update_or_create(
                codigo=dicofre, defaults={"nome": linha["freguesia"], "concelho": c, "ativa": True}
            )
            contagem["freguesias"] += criado
            vistos.add(dicofre)

        inativadas = 0
        if marcar_inativas:
            inativadas = Freguesia.objects.exclude(codigo__in=vistos).update(ativa=False)
        self.stdout.write(
            self.style.SUCCESS(
                f"Importação concluída: {len(vistos)} freguesias no ficheiro; novos: "
                f"{contagem['distritos']} distritos, {contagem['concelhos']} concelhos, "
                f"{contagem['freguesias']} freguesias; inativadas: {inativadas}."
            )
        )
