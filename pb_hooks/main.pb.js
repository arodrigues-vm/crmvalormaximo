/// <reference path="../pb_data/types.d.ts" />

// ------------------------------------------------------------ primeiro arranque
// Enquanto não existir nenhum utilizador, a app mostra o ecrã "Criar administrador".
routerAdd("GET", "/api/orc/estado", (e) => {
  return e.json(200, { precisa_configuracao: $app.countRecords("users") === 0 })
})

routerAdd("POST", "/api/orc/configurar", (e) => {
  if ($app.countRecords("users") > 0) {
    throw new ForbiddenError("A aplicação já está configurada.")
  }
  const body = e.requestInfo().body
  const nome = String(body.nome || "").trim()
  const email = String(body.email || "").trim()
  const password = String(body.password || "")
  if (!nome || !email || password.length < 8) {
    throw new BadRequestError("Indique nome, email e uma palavra-passe com pelo menos 8 caracteres.")
  }
  const u = new Record($app.findCollectionByNameOrId("users"))
  u.set("name", nome)
  u.setEmail(email)
  u.setPassword(password)
  u.setVerified(true)
  u.set("papel", "admin")
  $app.save(u)
  return e.json(200, { ok: true })
})

// ------------------------------------------------------------ recorrências
routerAdd("POST", "/api/orc/recorrencias/gerar", (e) => {
  const lib = require(`${__hooks}/lib.js`)
  return e.json(200, { criados: lib.gerarRecorrencias($app) })
}, $apis.requireAuth())

// Todos os dias às 06:05 lança os movimentos recorrentes que chegaram à data.
cronAdd("orc_recorrencias", "5 6 * * *", () => {
  const lib = require(`${__hooks}/lib.js`)
  const n = lib.gerarRecorrencias($app)
  if (n > 0) $app.logger().info("Movimentos recorrentes lançados", "quantidade", n)
})

// ------------------------------------------------------------ validações
onRecordCreate((e) => {
  require(`${__hooks}/lib.js`).validarTipoCategoria(e.app, e.record)
  e.next()
}, "movimentos", "recorrencias")

onRecordUpdate((e) => {
  require(`${__hooks}/lib.js`).validarTipoCategoria(e.app, e.record)
  e.next()
}, "movimentos", "recorrencias")

// Regista quem criou o movimento.
onRecordCreateRequest((e) => {
  if (e.auth) e.record.set("criado_por", e.auth.id)
  e.next()
}, "movimentos")

// Novos utilizadores são "membro" se o admin não indicar outro papel.
onRecordCreate((e) => {
  if (!e.record.getString("papel")) e.record.set("papel", "membro")
  e.next()
}, "users")

// Impede que fique sem nenhum administrador.
onRecordUpdate((e) => {
  const original = e.record.original()
  if (original.getString("papel") === "admin" && e.record.getString("papel") !== "admin") {
    const admins = e.app.countRecords("users", $dbx.hashExp({ papel: "admin" }))
    if (admins <= 1) throw new BadRequestError("Tem de existir pelo menos um administrador.")
  }
  e.next()
}, "users")
