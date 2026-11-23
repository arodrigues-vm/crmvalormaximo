/// <reference path="../pb_data/types.d.ts" />
// Esquema inicial da app Orçamento + dados de arranque (vindos da folha Orçamento.xlsx).

const AUTH = '@request.auth.id != ""'
const ADMIN = '@request.auth.papel = "admin"'

migrate((app) => {
  // ---------------------------------------------------------------- utilizadores
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new SelectField({ name: "papel", values: ["admin", "membro"], maxSelect: 1 }))
  users.listRule = AUTH
  users.viewRule = AUTH
  users.createRule = ADMIN
  // cada utilizador pode editar o próprio perfil (exceto o papel); o admin edita todos
  users.updateRule = `(id = @request.auth.id && @request.body.papel:isset = false) || ${ADMIN}`
  users.deleteRule = `${ADMIN} && id != @request.auth.id`
  users.manageRule = ADMIN
  app.save(users)

  // ---------------------------------------------------------------- tabelas de apoio
  const timestamps = [
    { name: "created", type: "autodate", onCreate: true },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ]

  const categorias = new Collection({
    type: "base",
    name: "categorias",
    listRule: AUTH, viewRule: AUTH, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      { name: "nome", type: "text", required: true, max: 80 },
      { name: "tipo", type: "select", required: true, values: ["saida", "entrada"], maxSelect: 1 },
      { name: "natureza", type: "select", values: ["fixa", "variavel"], maxSelect: 1 },
      { name: "grupo", type: "text", max: 60 },
      { name: "ambito_padrao", type: "select", values: ["pessoal", "profissional"], maxSelect: 1 },
      { name: "orcamento_mensal", type: "number", min: 0 },
      { name: "ativo", type: "bool" },
      { name: "ordem", type: "number" },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_categorias_nome ON categorias (nome COLLATE NOCASE)"],
  })
  app.save(categorias)

  const fornecedores = new Collection({
    type: "base",
    name: "fornecedores",
    // qualquer utilizador pode acrescentar um fornecedor ao registar uma despesa
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      { name: "nome", type: "text", required: true, max: 80 },
      { name: "categoria_padrao", type: "relation", collectionId: categorias.id, maxSelect: 1 },
      { name: "nif", type: "text", max: 20 },
      { name: "ativo", type: "bool" },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_fornecedores_nome ON fornecedores (nome COLLATE NOCASE)"],
  })
  app.save(fornecedores)

  const simples = (name) => new Collection({
    type: "base",
    name,
    listRule: AUTH, viewRule: AUTH, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      { name: "nome", type: "text", required: true, max: 60 },
      { name: "ativo", type: "bool" },
      ...timestamps,
    ],
    indexes: [`CREATE UNIQUE INDEX idx_${name}_nome ON ${name} (nome COLLATE NOCASE)`],
  })
  const metodos = simples("metodos_pagamento")
  app.save(metodos)
  const responsaveis = simples("responsaveis")
  app.save(responsaveis)

  const definicoes = new Collection({
    type: "base",
    name: "definicoes",
    listRule: AUTH, viewRule: AUTH, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      { name: "chave", type: "text", required: true, max: 60, pattern: "^[a-z0-9_]+$" },
      { name: "valor", type: "text", max: 500 },
      { name: "descricao", type: "text", max: 300 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_definicoes_chave ON definicoes (chave)"],
  })
  app.save(definicoes)

  // ---------------------------------------------------------------- recorrências
  const recorrencias = new Collection({
    type: "base",
    name: "recorrencias",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    fields: [
      { name: "descricao", type: "text", required: true, max: 120 },
      { name: "tipo", type: "select", required: true, values: ["saida", "entrada"], maxSelect: 1 },
      { name: "ambito", type: "select", required: true, values: ["pessoal", "profissional"], maxSelect: 1 },
      { name: "categoria", type: "relation", required: true, collectionId: categorias.id, maxSelect: 1 },
      { name: "fornecedor", type: "relation", collectionId: fornecedores.id, maxSelect: 1 },
      { name: "metodo_pagamento", type: "relation", collectionId: metodos.id, maxSelect: 1 },
      { name: "responsavel", type: "relation", collectionId: responsaveis.id, maxSelect: 1 },
      { name: "valor", type: "number", required: true, min: 0.01 },
      { name: "periodicidade", type: "select", required: true, maxSelect: 1,
        values: ["mensal", "bimestral", "trimestral", "semestral", "anual"] },
      { name: "proxima_data", type: "date", required: true },
      { name: "data_fim", type: "date" },
      { name: "pago_automatico", type: "bool" },
      { name: "ativo", type: "bool" },
      ...timestamps,
    ],
  })
  app.save(recorrencias)

  // ---------------------------------------------------------------- movimentos
  const movimentos = new Collection({
    type: "base",
    name: "movimentos",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH,
    fields: [
      { name: "data", type: "date", required: true },
      { name: "tipo", type: "select", required: true, values: ["saida", "entrada"], maxSelect: 1 },
      { name: "ambito", type: "select", required: true, values: ["pessoal", "profissional"], maxSelect: 1 },
      { name: "categoria", type: "relation", required: true, collectionId: categorias.id, maxSelect: 1 },
      { name: "valor", type: "number", required: true, min: 0.01 },
      { name: "fornecedor", type: "relation", collectionId: fornecedores.id, maxSelect: 1 },
      { name: "metodo_pagamento", type: "relation", collectionId: metodos.id, maxSelect: 1 },
      { name: "responsavel", type: "relation", collectionId: responsaveis.id, maxSelect: 1 },
      { name: "pago", type: "bool" },
      { name: "descricao", type: "text", max: 300 },
      { name: "anexo", type: "file", maxSelect: 3, maxSize: 10485760, protected: true,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] },
      { name: "recorrencia", type: "relation", collectionId: recorrencias.id, maxSelect: 1 },
      { name: "criado_por", type: "relation", collectionId: users.id, maxSelect: 1 },
      ...timestamps,
    ],
    indexes: [
      "CREATE INDEX idx_movimentos_data ON movimentos (data)",
      "CREATE INDEX idx_movimentos_categoria ON movimentos (categoria)",
    ],
  })
  app.save(movimentos)

  // ---------------------------------------------------------------- dados de arranque
  const add = (col, data) => {
    const r = new Record(col)
    r.load(data)
    app.save(r)
    return r
  }

  // [nome, tipo, natureza, grupo, âmbito]
  const cats = [
    ["Seguro Saúde", "saida", "fixa", "Saúde", "pessoal"],
    ["Comunicações", "saida", "fixa", "Casa", "pessoal"],
    ["Electricidade", "saida", "fixa", "Casa", "pessoal"],
    ["Água", "saida", "fixa", "Casa", "pessoal"],
    ["Supermercado", "saida", "variavel", "Alimentação", "pessoal"],
    ["Talho", "saida", "variavel", "Alimentação", "pessoal"],
    ["Peixaria", "saida", "variavel", "Alimentação", "pessoal"],
    ["Combustível", "saida", "variavel", "Viatura", "pessoal"],
    ["Manutenção Viatura", "saida", "variavel", "Viatura", "pessoal"],
    ["Mesada Carolina", "saida", "fixa", "Família", "pessoal"],
    ["Faculdade Carolina", "saida", "fixa", "Família", "pessoal"],
    ["Vestuário e calçado", "saida", "variavel", "Pessoal", "pessoal"],
    ["Lazer", "saida", "variavel", "Pessoal", "pessoal"],
    ["Almoço/Jantar", "saida", "variavel", "Pessoal", "pessoal"],
    ["Software e subscrições", "saida", "fixa", "Atividade profissional", "profissional"],
    ["Salário", "entrada", "fixa", "Rendimentos", "pessoal"],
    ["Prestação de serviços", "entrada", "variavel", "Rendimentos", "profissional"],
    ["Outras receitas", "entrada", "variavel", "Rendimentos", "pessoal"],
  ]
  const catId = {}
  cats.forEach((c, i) => {
    catId[c[0]] = add(categorias, {
      nome: c[0], tipo: c[1], natureza: c[2], grupo: c[3], ambito_padrao: c[4], ativo: true, ordem: i + 1,
    }).id
  })

  const forn = [
    ["EDP", "Electricidade"], ["SMAS", "Água"], ["ALDI", "Supermercado"], ["LIDL", "Supermercado"],
    ["Jumbo", "Supermercado"], ["Continente", "Supermercado"], ["Mercadona", "Supermercado"],
    ["Vodafone", "Comunicações"], ["Digi", "Comunicações"], ["Netflix", "Lazer"],
    ["Seguradora", "Seguro Saúde"], ["ISEP", "Faculdade Carolina"],
    ["Claude", "Software e subscrições"], ["Gemini", "Software e subscrições"],
    ["Takeaway", "Almoço/Jantar"], ["Outros", ""],
  ]
  forn.forEach((f) => add(fornecedores, { nome: f[0], categoria_padrao: catId[f[1]] || "", ativo: true }))

  ;["Débito directo", "MB", "MBWay", "Transferência", "Dinheiro"]
    .forEach((n) => add(metodos, { nome: n, ativo: true }))
  ;["Alexandre", "Pais"].forEach((n) => add(responsaveis, { nome: n, ativo: true }))

  ;[
    ["meses_media", "6", "Nº de meses usados para calcular a média das despesas variáveis na previsão"],
    ["antecedencia_recorrencias", "0", "Dias de antecedência com que os movimentos recorrentes são lançados (0 = no próprio dia)"],
    ["nome_app", "Orçamento", "Nome apresentado no topo da aplicação"],
  ].forEach((d) => add(definicoes, { chave: d[0], valor: d[1], descricao: d[2] }))
}, (app) => {
  ;["movimentos", "recorrencias", "definicoes", "responsaveis", "metodos_pagamento", "fornecedores", "categorias"]
    .forEach((n) => {
      try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
    })
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("papel")
  app.save(users)
})
