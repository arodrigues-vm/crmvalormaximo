"""Listas usadas pelo código, com os valores iniciais aprovados (14/11/2026).

Os valores são apenas o ponto de partida: o Administrador altera-os na aplicação.
"""

LISTAS = {
    # chave: (nome, módulo, descrição, valores iniciais)
    "papeis_entidade": ("Papéis de entidade", "entidades", "Papéis comerciais de pessoas e empresas.", []),
    "origens_contacto": ("Origens de contacto", "entidades", "Como o contacto chegou à agência.", []),
    "tipos_imovel": (
        "Tipos de imóvel",
        "imoveis",
        "",
        ["Apartamento", "Moradia", "Terreno", "Loja", "Escritório", "Armazém", "Garagem/Estacionamento",
         "Prédio", "Quinta/Herdade"],
    ),
    "tipologias": ("Tipologias", "imoveis", "", ["T0", "T1", "T2", "T3", "T4", "T5", "T6 ou mais"]),
    "estados_comercializacao": (
        "Estados de comercialização",
        "imoveis",
        "",
        ["Em preparação", "Disponível", "Reservado", "Vendido", "Arrendado", "Retirado"],
    ),
    "condicoes_fisicas": (
        "Condições físicas",
        "imoveis",
        "",
        ["Novo", "Em construção", "Usado", "Para recuperar", "Recuperado/Remodelado"],
    ),
    "zonas_exteriores": (
        "Zonas exteriores",
        "imoveis",
        "",
        ["Varanda", "Terraço", "Jardim", "Logradouro", "Piscina", "Pátio"],
    ),
    "certificados_energeticos": (
        "Classes de certificado energético",
        "imoveis",
        "",
        ["A+", "A", "B", "B-", "C", "D", "E", "F", "Isento"],
    ),
    "zonas_comerciais": ("Zonas comerciais", "imoveis", "Zonas de atuação comercial (diferentes da CAOP).", []),
}  # fmt: skip


def semear_listas(**kwargs):
    """Cria as listas em falta. Os valores iniciais só são criados quando a lista é nova,
    para nunca repor valores que o Administrador tenha alterado ou desativado."""
    from .models import Lista, ValorLista

    for chave, (nome, modulo, descricao, valores) in LISTAS.items():
        lista, criada = Lista.objects.get_or_create(
            chave=chave, defaults={"nome": nome, "modulo": modulo, "descricao": descricao}
        )
        if criada:
            ValorLista.objects.bulk_create([ValorLista(lista=lista, nome=v, ordem=i) for i, v in enumerate(valores)])
