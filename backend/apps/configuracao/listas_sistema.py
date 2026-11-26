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

CAT_ESTADO_VISITA = [
    {"valor": "agendada", "nome": "Agendada"},
    {"valor": "confirmada", "nome": "Confirmada"},
    {"valor": "realizada", "nome": "Realizada"},
    {"valor": "cancelada", "nome": "Cancelada"},
    {"valor": "nao_compareceu", "nome": "Não compareceu"},
]
CAT_ESTADO_INTERESSE = [
    {"valor": "ativo", "nome": "Ativo (em acompanhamento)"},
    {"valor": "inativo", "nome": "Inativo"},
]

CAT_TIPO_AGENCIA = [
    {"valor": "propria", "nome": "Própria (a nossa agência)"},
    {"valor": "rede", "nome": "Rede"},
    {"valor": "externa", "nome": "Externa"},
]

# D-46: «Cliente externo» (cliente de outra agência): nas visitas e propostas o responsável escolhe-se em Agentes.
CAT_TIPO_CLIENTE = [
    {"valor": "geral", "nome": "Tipo de cliente"},
    {"valor": "cliente_externo", "nome": "Cliente externo (responsável escolhido em Agentes)"},
]

CAT_ESTADO_PROPOSTA = [
    {"valor": "negociacao", "nome": "Em negociação"},
    {"valor": "aceite", "nome": "Aceite (pode gerar transação)"},
    {"valor": "recusada", "nome": "Recusada"},
    {"valor": "retirada", "nome": "Retirada pelo comprador"},
    {"valor": "expirada", "nome": "Expirada"},
]

# D-47: estados da transação. «cpcv» e «escritura» só se usam na venda.
CAT_ESTADO_TRANSACAO = [
    {"valor": "preparacao", "nome": "Em preparação"},
    {"valor": "cpcv", "nome": "CPCV assinado (só venda)"},
    {"valor": "escritura", "nome": "Escritura marcada (só venda)"},
    {"valor": "concluida", "nome": "Concluída (escritura / contrato de arrendamento)"},
    {"valor": "cancelada", "nome": "Cancelada"},
]

# D-49: quanto da comissão se paga no CPCV (o resto na escritura). Usado para propor as prestações.
CAT_MOMENTO_PAGAMENTO = [
    {"valor": "cpcv_100", "nome": "100% no CPCV"},
    {"valor": "cpcv_50", "nome": "50% no CPCV e 50% na escritura"},
    {"valor": "escritura_100", "nome": "100% na escritura"},
]
CAT_TIPO_DOCUMENTO = [
    {"valor": "fatura", "nome": "Fatura (fica a pagar)"},
    {"valor": "recibo", "nome": "Recibo / fatura-recibo"},
    {"valor": "credito", "nome": "Nota de crédito (reduz o valor a pagar)"},
]

# D-50: tipos de documento da transação; a categoria diz a que operação se aplicam (lista de verificação).
CAT_DOCUMENTO_TRANSACAO = [
    {"valor": "ambos", "nome": "Venda e arrendamento"},
    {"valor": "venda", "nome": "Só venda"},
    {"valor": "arrendamento", "nome": "Só arrendamento"},
]
CAT_ESTADO_TAREFA = [
    {"valor": "aberta", "nome": "Por fazer"},
    {"valor": "em_curso", "nome": "Em curso"},
    {"valor": "concluida", "nome": "Concluída"},
    {"valor": "cancelada", "nome": "Cancelada"},
    {"valor": "substituida", "nome": "Não executada — plano substituído (só o CRM a usa, num novo ciclo)"},
]
CAT_CATEGORIA_TAREFA = [
    {"valor": "pos_venda", "nome": "Pós-venda (ligada a uma transação concluída)"},
    {"valor": "geral", "nome": "Geral"},
    {"valor": "marketing", "nome": "Marketing de imóveis (ligada a um plano)"},
    {"valor": "marketing_entidades", "nome": "Marketing de entidades (ligada a um plano de entidades)"},
]

CAT_ESTADO_COMPROMISSO = [
    {"valor": "agendado", "nome": "Agendado"},
    {"valor": "concluido", "nome": "Concluído"},
    {"valor": "cancelado", "nome": "Cancelado"},
]

CATEGORIAS = {
    "estados_compromisso": CAT_ESTADO_COMPROMISSO,
    "tipos_documento_transacao": CAT_DOCUMENTO_TRANSACAO,
    "estados_tarefa": CAT_ESTADO_TAREFA,
    "categorias_tarefa": CAT_CATEGORIA_TAREFA,
    "momentos_pagamento_comissao": CAT_MOMENTO_PAGAMENTO,
    "tipos_documento_consultor": CAT_TIPO_DOCUMENTO,
    "estados_transacao": CAT_ESTADO_TRANSACAO,
    "operacoes": CAT_OPERACAO,
    "status_imovel": CAT_STATUS,
    "status_entidade": CAT_STATUS,
    "regimes_cmi": CAT_REGIME,
    "estados_comercializacao": CAT_ESTADO_COMERCIALIZACAO,
    "estados_oportunidade": CAT_ESTADO_OPORTUNIDADE,
    "estados_procura": CAT_ESTADO_PROCURA,
    "estados_visita": CAT_ESTADO_VISITA,
    "estados_proposta": CAT_ESTADO_PROPOSTA,
    "tipos_agencia": CAT_TIPO_AGENCIA,
    "tipos_angariacao": CAT_TIPO_AGENCIA,
    "papeis_entidade": CAT_TIPO_CLIENTE,
    "status_agentes": CAT_STATUS,
    "estados_interesse": CAT_ESTADO_INTERESSE,
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
    "tipos_agencia": (
        "Tipos de agência",
        "agencias",
        "A categoria «Própria» identifica a nossa agência (ex.: interesses automáticos das visitas).",
        [("Própria", "propria"), ("Rede", "rede"), ("Externa", "externa")],
    ),
    "tipos_angariacao": (
        "Tipos de angariação",
        "imoveis",
        "D-46: com a categoria «Própria», o responsável do imóvel escolhe-se na Equipa; nas outras, em Agentes.",
        [("Própria", "propria"), ("Rede", "rede"), ("Externa", "externa")],
    ),
    "estados_transacao": (
        "Estados de transação",
        "transacoes",
        "No arrendamento não há CPCV nem escritura: passa de «Em preparação» a «Concluída».",
        [
            ("Em preparação", "preparacao"),
            ("CPCV assinado", "cpcv"),
            ("Escritura marcada", "escritura"),
            ("Concluída", "concluida"),
            ("Cancelada", "cancelada"),
        ],
    ),
    "tipos_documento_transacao": (
        "Tipos de documento da transação",
        "transacoes",
        "Lista de verificação dos documentos do negócio (ligações para o OneDrive, D-26/D-50).",
        [
            ("CPCV", "venda"),
            ("Escritura", "venda"),
            ("Contrato de arrendamento", "arrendamento"),
            ("Caderneta predial", "ambos"),
            ("Certidão permanente", "ambos"),
            ("Licença de utilização", "ambos"),
            ("Certificado energético", "ambos"),
            ("Ficha técnica de habitação", "venda"),
        ],
    ),
    "estados_tarefa": (
        "Estados de tarefa",
        "tarefas",
        "",
        [
            ("Por fazer", "aberta"),
            ("Em curso", "em_curso"),
            ("Concluída", "concluida"),
            ("Cancelada", "cancelada"),
            ("Não executada — Plano substituído", "substituida"),
        ],
    ),
    "categorias_tarefa": (
        "Categorias de tarefa",
        "tarefas",
        "«Pós-venda» exige uma transação concluída (escritura ou contrato).",
        [
            ("Pós-venda", "pos_venda"),
            ("Geral", "geral"),
            ("Marketing de imóveis", "marketing"),
            ("Marketing de entidades", "marketing_entidades"),
        ],
    ),
    "tipos_compromisso": (
        "Tipos de compromisso",
        "agenda",
        "Compromissos criados na Agenda (D-51).",
        ["Reunião", "Chamada", "Avaliação de imóvel", "Outro"],
    ),
    "estados_compromisso": (
        "Estados de compromisso",
        "agenda",
        "Cancelar e reabrir são ações expressas, com motivo (Cap. 17).",
        [("Agendado", "agendado"), ("Concluído", "concluido"), ("Cancelado", "cancelado")],
    ),
    "tipos_agente": ("Tipos de agente", "agentes", "", ["Consultor", "Agente da rede", "Agente externo"]),
    "status_agentes": (
        "Status de agentes e agências",
        "agentes",
        "",
        [("Ativo", "ativo"), ("Inativo", "inativo")],
    ),
    "estados_proposta": (
        "Estados de proposta",
        "propostas",
        "Só as propostas de categoria «Aceite» podem gerar uma transação.",
        [("Em negociação", "negociacao"), ("Aceite", "aceite"), ("Recusada", "recusada"),
         ("Retirada", "retirada"), ("Expirada", "expirada")],
    ),
    "papeis_participante": (
        "Papéis dos participantes (propostas e transações)",
        "propostas",
        "",
        ["Comprador", "Proprietário", "Representante legal", "Procurador"],
    ),
    "estados_visita": (
        "Estados de visita",
        "visitas",
        "A categoria decide o comportamento (ex.: só uma visita «Realizada» atualiza a última visita do interesse).",
        [("Agendada", "agendada"), ("Confirmada", "confirmada"), ("Realizada", "realizada"),
         ("Cancelada", "cancelada"), ("Não compareceu", "nao_compareceu")],
    ),
    "avaliacoes_visita": (
        "Avaliações da visita",
        "visitas",
        "Escala usada nos critérios da ficha de visita.",
        ["Muito mau", "Mau", "Médio", "Bom", "Muito bom"],
    ),
    "origens_interesse": (
        "Origens de interesse",
        "visitas",
        "",
        ["Visita", "Contacto telefónico", "Site / portal", "Email", "Outro"],
    ),
    "graus_interesse": ("Graus de interesse", "visitas", "", ["Muito baixo", "Baixo", "Médio", "Alto", "Muito alto"]),
    "estados_interesse": (
        "Estados de interesse",
        "visitas",
        "Só os interesses de categoria «Ativo» aparecem como em acompanhamento.",
        [("Ativo", "ativo"), ("Em negociação", "ativo"), ("Desistiu", "inativo"), ("Concluído", "inativo")],
    ),
    "momentos_pagamento_comissao": (
        "Momentos de pagamento da comissão",
        "angariacoes",
        "",
        [
            ("100% no CPCV", "cpcv_100"),
            ("50% no CPCV e 50% na escritura", "cpcv_50"),
            ("100% na escritura", "escritura_100"),
        ],
    ),
    "tipos_documento_consultor": (
        "Tipos de documento de consultor",
        "faturacao",
        "Documentos que os consultores emitem à agência pela sua parte da comissão (D-49).",
        [("Fatura", "fatura"), ("Fatura-recibo", "recibo"), ("Recibo", "recibo"), ("Nota de crédito", "credito")],
    ),
    "meios_pagamento": (
        "Meios de pagamento",
        "faturacao",
        "",
        ["Transferência bancária", "Cheque", "Numerário", "MB WAY"],
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
