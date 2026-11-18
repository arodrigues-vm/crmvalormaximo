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
    "artigos_matriciais": ("Tipos de artigo matricial", "imoveis", "", ["Urbano", "Rústico", "Misto"]),
    "climatizacoes": (
        "Climatização",
        "imoveis",
        "",
        ["Não tem", "Aquecimento central", "Ar condicionado", "Aquecimento central e AC",
         "Aquecimento e pré-instalação de AC", "AC e pré-instalação de aquecimento", "Pavimento radiante",
         "Pré-instalação de AC", "Pré-instalação de aquecimento"],
    ),
    "situacoes_imovel": (
        "Situação do imóvel",
        "imoveis",
        "",
        ["Construção concluída", "Projeto aprovado", "Imóvel restaurado", "Em beneficiação"],
    ),
    "fontes_areas": (
        "Fontes das áreas",
        "imoveis",
        "",
        ["CPU/R", "CRP", "Planta", "Levantamento", "Ficha técnica", "Medições", "Outro"],
    ),
    "quantidades": (
        "Quantidades (Não, 1 a 10)",
        "geral",
        "",
        ["Não", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    ),
    "caixilharias": (
        "Caixilharias",
        "imoveis",
        "",
        ["Alumínio termolacado vidro duplo", "Alumínio termolacado vidro simples", "Alumínio anodizado vidro duplo",
         "Alumínio anodizado vidro simples", "Madeira vidro simples", "Madeira vidro duplo", "PVC vidro simples",
         "PVC vidro duplo", "Metálica"],
    ),
    "classificacoes": (
        "Classificações (Excelente a Muito mau)",
        "geral",
        "",
        ["Excelente", "Muito bom", "Bom", "Razoável", "Mau", "Muito mau"],
    ),
    "cozinhas": ("Cozinhas", "imoveis", "", ["Livre", "Mobilada", "Equipada", "Mobilada e equipada"]),
    "piscinas": ("Piscinas", "imoveis", "", ["Não", "Exterior", "Interior", "Exterior e interior"]),
    "garagens": (
        "Garagens",
        "imoveis",
        "",
        ["1 lugar", "Box 1 lugar", "2 lugares", "Box 2 lugares", "2 lugares em fila", "Box 2 lugares em fila",
         "2 lugares lado a lado", "Box 2 lugares lado a lado", "3 lugares", "Box 3 lugares", "4 lugares",
         "Box 4 lugares", "5 lugares", "Box 5 lugares"],
    ),
    "conservacoes": (
        "Estados de conservação",
        "imoveis",
        "",
        ["Novo", "Excelente", "Muito bom", "Bom", "Razoável", "Mau", "Muito mau", "Ruína"],
    ),
    "acabamentos": ("Acabamentos", "imoveis", "", ["Luxo", "Muito bons", "Bons", "Correntes", "Modestos", "Maus"]),
    "prioridades": ("Prioridades", "angariacoes", "", ["Muito baixa", "Baixa", "Média", "Alta", "Muito alta"]),
    "comercializacao_prevista": (
        "Comercialização prevista",
        "angariacoes",
        "Facilidade prevista de venda do imóvel angariado.",
        ["Imediato — até 6 meses", "Normal — 7 a 18 meses", "Difícil — 19 a 36 meses",
         "Muito difícil — mais de 36 meses"],
    ),
    "momentos_pagamento_comissao": (
        "Momentos de pagamento da comissão",
        "angariacoes",
        "",
        ["100% no CPCV", "50% no CPCV e 50% na escritura", "100% na escritura"],
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
    "sim_nao": ("Sim / Não", "geral", "Respostas Sim, Não ou Não sabe.", ["Sim", "Não", "Não sabe"]),
    "niveis_motivacao": (
        "Níveis de motivação",
        "geral",
        "",
        ["Muito baixa", "Baixa", "Média", "Alta", "Muito alta"],
    ),
    "destinos_imovel": (
        "Destinos do imóvel",
        "imoveis",
        "",
        ["Habitação", "Habitação ou serviços", "Comércio", "Escritório", "Armazém", "Garagem",
         "Habitação e comércio", "Habitação e escritórios", "Habitação, comércio e escritórios",
         "Habitação e armazém", "Armazém e escritório", "Outra"],
    ),
    "ocupacoes_imovel": (
        "Ocupações do imóvel",
        "imoveis",
        "",
        ["Devoluto", "Proprietário", "Arrendado", "Outro"],
    ),
    "entidades_bancarias": (
        "Entidades bancárias",
        "geral",
        "",
        ["Santander", "CGD", "Millennium", "BPI", "Novo Banco", "Banco CTT", "UCI"],
    ),
    "modos_pagamento": (
        "Modos de pagamento",
        "procuras",
        "",
        ["Financiamento", "Financiamento 100%", "Pronto pagamento"],
    ),
    "aceita_obras": (
        "Obras (aceita?)",
        "procuras",
        "Se o comprador aceita imóveis que precisem de obras.",
        ["Sim", "Não", "Depende", "Poucas obras", "Obras simples"],
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
            ("Proposta", "disponivel"),
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
            ("Contacto", "aberta"),
            ("Pré-angariação", "aberta"),
            ("ACM apresentado", "aberta"),
            ("Pendente", "aberta"),
            ("Angariado", "ganha"),
            ("Cancelado", "perdida"),
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
        "Estados do imóvel",
        "imoveis",
        "Usado também nos critérios das procuras.",
        ["Novo(a)", "Usado(a)", "Reabilitado(a)", "Restaurado(a)", "Ruína"],
    ),
    "zonas_exteriores": (
        "Zonas exteriores",
        "imoveis",
        "",
        ["Varanda", "Terraço", "Jardim", "Logradouro", "Piscina", "Pátio"],
    ),
    "certificados_energeticos": (
        "Classes energéticas",
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
