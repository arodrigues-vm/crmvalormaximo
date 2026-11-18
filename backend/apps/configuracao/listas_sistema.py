"""Listas usadas pelo código, com os valores iniciais aprovados (14/11/2026).

Os valores são apenas o ponto de partida: o Administrador altera-os na aplicação.
"""

CAT_OPERACAO = [{"valor": "venda", "nome": "Venda"}, {"valor": "arrendamento", "nome": "Arrendamento"}]
CAT_STATUS = [
    {"valor": "ativo", "nome": "Ativo"},
    {"valor": "inativo", "nome": "Inativo"},
    {"valor": "arquivado", "nome": "Arquivado (escondido por omissão)"},
]

# Listas com categorias: chave -> categorias. Os valores iniciais são pares (nome, categoria).
CAT_REGIME = [
    {"valor": "exclusivo", "nome": "Exclusivo"},
    {"valor": "nao_exclusivo", "nome": "Não exclusivo"},
]

CAT_ESTADO_COMERCIALIZACAO = [
    {"valor": "preparacao", "nome": "Em preparação (entra nas correspondências)"},
    {"valor": "disponivel", "nome": "Disponível (entra nas correspondências)"},
    {"valor": "reservado", "nome": "Reservado (fora das correspondências)"},
    {"valor": "indisponivel", "nome": "Indisponível (fora das correspondências)"},
]
CAT_ESTADO_OPORTUNIDADE = [
    {"valor": "aberta", "nome": "Em curso"},
    {"valor": "ganha", "nome": "Angariada"},
    {"valor": "perdida", "nome": "Perdida"},
]
CAT_ESTADO_PROCURA = [
    {"valor": "ativa", "nome": "Ativa (procura correspondências)"},
    {"valor": "inativa", "nome": "Inativa"},
]

CATEGORIAS = {
    "operacoes": CAT_OPERACAO,
    "status_imovel": CAT_STATUS,
    "status_entidade": CAT_STATUS,
    "regimes_cmi": CAT_REGIME,
    "estados_comercializacao": CAT_ESTADO_COMERCIALIZACAO,
    "estados_oportunidade": CAT_ESTADO_OPORTUNIDADE,
    "estados_procura": CAT_ESTADO_PROCURA,
}

LISTAS = {
    "operacoes": (
        "Operações",
        "imoveis",
        "Venda, arrendamento…",
        [("Venda", "venda"), ("Arrendamento", "arrendamento")],
    ),
    "status_imovel": (
        "Status do imóvel",
        "imoveis",
        "",
        [("Ativo", "ativo"), ("Inativo", "inativo"), ("Arquivado", "arquivado")],
    ),
    "regimes_cmi": (
        "Regimes de contrato (CMI)",
        "angariacoes",
        "Regime do contrato de mediação. A categoria Exclusivo impede contratos sobrepostos no mesmo imóvel.",
        [("Exclusivo", "exclusivo"), ("Não exclusivo", "nao_exclusivo")],
    ),
    "papeis_interveniente_cmi": (
        "Papéis de interveniente (CMI)",
        "angariacoes",
        "Qualidade em que cada parte intervém no contrato.",
        ["Proprietário", "Representante legal", "Procurador"],
    ),
    "tipos_ligacao": (
        "Tipos de ligação externa",
        "geral",
        "Ligações para pastas do OneDrive ou outros serviços.",
        ["Fotografias", "Documentos", "Outro"],
    ),
    # chave: (nome, módulo, descrição, valores iniciais)
    "papeis_entidade": ("Tipos de cliente", "entidades", "Proprietário, comprador, arrendatário…", []),
    "estados_civis": (
        "Estados civis",
        "entidades",
        "",
        ["Casado(a)", "Solteiro(a)", "Viúvo(a)", "Divorciado(a)", "União de facto"],
    ),
    "regimes_casamento": (
        "Regimes de casamento",
        "entidades",
        "",
        ["Comunhão de bens adquiridos", "Comunhão geral de bens", "Separação de bens"],
    ),
    "status_entidade": (
        "Status da entidade",
        "entidades",
        "",
        [("Ativo", "ativo"), ("Inativo", "inativo")],
    ),
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
        "A categoria decide se o imóvel entra nas correspondências com procuras.",
        [
            ("Em preparação", "preparacao"),
            ("Disponível", "disponivel"),
            ("Reservado", "reservado"),
            ("Vendido", "indisponivel"),
            ("Arrendado", "indisponivel"),
            ("Retirado", "indisponivel"),
        ],
    ),
    "estados_oportunidade": (
        "Estados de oportunidade",
        "oportunidades",
        "",
        [
            ("Novo contacto", "aberta"),
            ("Em qualificação", "aberta"),
            ("Avaliação marcada", "aberta"),
            ("Angariada", "ganha"),
            ("Perdida", "perdida"),
        ],
    ),
    "estados_procura": (
        "Estados de procura",
        "procuras",
        "Só as procuras de categoria «Ativa» geram correspondências.",
        [("Ativa", "ativa"), ("Em pausa", "inativa"), ("Concluída", "inativa"), ("Desistiu", "inativa")],
    ),
    "urgencias": ("Urgências", "procuras", "", ["Alta", "Média", "Baixa"]),
    "tipos_interacao": (
        "Tipos de interação",
        "geral",
        "Chamadas, reuniões e outros contactos registados nas fichas.",
        ["Chamada telefónica", "Reunião presencial", "Email", "WhatsApp", "Visita ao imóvel", "Outro"],
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


def semear_parametros():
    from .models import PARAMETROS, Parametro

    for chave, (nome, modulo, descricao, valor) in PARAMETROS.items():
        Parametro.objects.get_or_create(
            chave=chave, defaults={"nome": nome, "modulo": modulo, "descricao": descricao, "valor": valor}
        )


def semear_listas(**kwargs):
    """Cria as listas em falta. Os valores iniciais só são criados quando a lista é nova,
    para nunca repor valores que o Administrador tenha alterado ou desativado."""
    from .models import Lista, ValorLista

    for chave, (nome, modulo, descricao, valores) in LISTAS.items():
        lista, criada = Lista.objects.get_or_create(
            chave=chave,
            defaults={"nome": nome, "modulo": modulo, "descricao": descricao, "categorias": CATEGORIAS.get(chave, [])},
        )
        if criada:
            novos = []
            for ordem, v in enumerate(valores):
                nome_valor, categoria = v if isinstance(v, tuple) else (v, "")
                novos.append(ValorLista(lista=lista, nome=nome_valor, categoria=categoria, ordem=ordem))
            ValorLista.objects.bulk_create(novos)
    semear_parametros()
