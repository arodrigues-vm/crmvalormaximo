/// <reference path="../pb_data/types.d.ts" />
// Chaves de acesso (impressão digital / Face ID / Windows Hello) por aparelho.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const passkeys = new Collection({
    type: "base",
    name: "passkeys",
    // cada pessoa vê e remove só os seus aparelhos; a criação é feita pelo servidor
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "nome", type: "text", max: 80 },
      { name: "credencial_id", type: "text", required: true, max: 2000 },
      { name: "credencial", type: "text", required: true, max: 20000, hidden: true },
      { name: "ultimo_uso", type: "date" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_passkeys_cred ON passkeys (credencial_id)"],
  })
  app.save(passkeys)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("passkeys")) } catch (_) {}
})
