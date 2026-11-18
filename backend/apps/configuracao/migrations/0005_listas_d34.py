"""D-34: atualiza listas JÁ existentes com os valores pedidos pelo proprietário.

As listas novas são criadas pelo arranque (semear_listas). Aqui só se mexe em listas que já existiam:
os valores antigos que já não constam são desativados (não apagados: os registos que os usam mantêm-nos).
"""

from django.db import migrations
from django.db.models import F

RENOMEAR = {
    "estados_oportunidade": {
        "Novo contacto": "Contacto",
        "Em qualificação": "Pré-angariação",
        "Avaliação marcada": "ACM apresentado",
        "Angariada": "Angariado",
        "Perdida": "Cancelado",
    },
    "condicoes_fisicas": {"Novo": "Novo(a)", "Usado": "Usado(a)"},
}
# (nome, categoria, inserir depois de)
ACRESCENTAR = {
    "estados_oportunidade": [("Pendente", "aberta", "ACM apresentado")],
    "estados_comercializacao": [("Proposta", "disponivel", "Disponível")],
    "condicoes_fisicas": [("Reabilitado(a)", "", "Usado(a)"), ("Restaurado(a)", "", "Reabilitado(a)"),
                          ("Ruína", "", "Restaurado(a)")],
}
DESATIVAR = {"condicoes_fisicas": ["Em construção", "Para recuperar", "Recuperado/Remodelado"]}
NOMES_LISTA = {"condicoes_fisicas": "Estados do imóvel", "certificados_energeticos": "Classes energéticas"}


def atualizar(apps, schema_editor):
    Lista = apps.get_model("configuracao", "Lista")
    Valor = apps.get_model("configuracao", "ValorLista")
    for chave, mapa in RENOMEAR.items():
        for antigo, novo in mapa.items():
            if not Valor.objects.filter(lista__chave=chave, nome=novo).exists():
                Valor.objects.filter(lista__chave=chave, nome=antigo).update(nome=novo)
    for chave, valores in ACRESCENTAR.items():
        lista = Lista.objects.filter(chave=chave).first()
        if lista is None:
            continue
        for nome, categoria, depois in valores:
            if Valor.objects.filter(lista=lista, nome=nome).exists():
                continue
            anterior = Valor.objects.filter(lista=lista, nome=depois).first()
            if anterior is None:
                ordem = (Valor.objects.filter(lista=lista).order_by("-ordem").values_list("ordem", flat=True).first() or 0) + 1
            else:
                ordem = anterior.ordem + 1
                Valor.objects.filter(lista=lista, ordem__gte=ordem).update(ordem=F("ordem") + 1)
            Valor.objects.create(lista=lista, nome=nome, categoria=categoria, ordem=ordem)
    for chave, nomes in DESATIVAR.items():
        Valor.objects.filter(lista__chave=chave, nome__in=nomes).update(ativo=False)
    for chave, nome in NOMES_LISTA.items():
        Lista.objects.filter(chave=chave).update(nome=nome)


class Migration(migrations.Migration):
    dependencies = [("configuracao", "0004_categorias_estados_comercializacao")]

    operations = [migrations.RunPython(atualizar, migrations.RunPython.noop)]
