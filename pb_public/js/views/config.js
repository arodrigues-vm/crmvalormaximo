// Configuração sem código: categorias, fornecedores, métodos, responsáveis, utilizadores, definições e perfil.
import {
  pb, state, h, eur, abrirModal, fecharModal, aviso, erroTexto, confirmar, isAdmin, rotulo, nomeDe,
  recarregar, emitir, lerLocal, gravarLocal, VERSAO_APP,
} from "../core.js"
import { seccaoPasskeys } from "../passkey.js"

// Descrição de cada tabela editável. Para acrescentar um campo novo basta criá-lo no painel
// de administração (/_/) e acrescentá-lo aqui.
const TABELAS = {
  categorias: {
    titulo: "Categorias", estado: "cats", ordem: (a, b) => (b.tipo.localeCompare(a.tipo)) || (a.grupo || "").localeCompare(b.grupo || "", "pt") || a.nome.localeCompare(b.nome, "pt"),
    ajuda: "Defina se cada categoria é despesa ou receita, fixa ou variável, o grupo a que pertence e (opcional) um orçamento mensal.",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true, lista: true },
      { nome: "tipo", rotulo: "Tipo", tipo: "select", opcoes: ["saida", "entrada"], obrigatorio: true, lista: true },
      { nome: "natureza", rotulo: "Fixa / variável", tipo: "select", opcoes: ["fixa", "variavel"], obrigatorio: true, lista: true },
      { nome: "grupo", rotulo: "Grupo", tipo: "text", sugestoes: () => [...new Set(state.cats.map((c) => c.grupo).filter(Boolean))], lista: true },
      { nome: "ambito_padrao", rotulo: "Âmbito por omissão", tipo: "select", opcoes: ["pessoal", "profissional"] },
      { nome: "orcamento_mensal", rotulo: "Orçamento mensal (€)", tipo: "number", lista: true, moeda: true },
      { nome: "ordem", rotulo: "Ordem", tipo: "number" },
      { nome: "ativo", rotulo: "Ativa", tipo: "bool", omissao: true, lista: true },
    ],
  },
  fornecedores: {
    titulo: "Fornecedores", estado: "forn", ordem: (a, b) => a.nome.localeCompare(b.nome, "pt"), qualquer: ["create"],
    ajuda: "A categoria por omissão é sugerida automaticamente quando escolhe o fornecedor num movimento.",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true, lista: true },
      { nome: "categoria_padrao", rotulo: "Categoria por omissão", tipo: "relacao", fonte: "cats", lista: true },
      { nome: "nif", rotulo: "NIF", tipo: "text" },
      { nome: "ativo", rotulo: "Ativo", tipo: "bool", omissao: true, lista: true },
    ],
  },
  metodos_pagamento: {
    titulo: "Métodos de pagamento", estado: "metodos", ordem: (a, b) => a.nome.localeCompare(b.nome, "pt"),
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true, lista: true },
      { nome: "ativo", rotulo: "Ativo", tipo: "bool", omissao: true, lista: true },
    ],
  },
  responsaveis: {
    titulo: "Responsáveis", estado: "resp", ordem: (a, b) => a.nome.localeCompare(b.nome, "pt"),
    ajuda: "Quem paga ou recebe (ex.: Alexandre, Pais). Não é o mesmo que os utilizadores com acesso à app.",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true, lista: true },
      { nome: "ativo", rotulo: "Ativo", tipo: "bool", omissao: true, lista: true },
    ],
  },
  users: {
    titulo: "Utilizadores", estado: "users", soAdmin: true, ordem: (a, b) => (a.name || "").localeCompare(b.name || "", "pt"),
    ajuda: "Pessoas com acesso à app. Todos veem e registam os mesmos movimentos; só administradores alteram a configuração.",
    campos: [
      { nome: "name", rotulo: "Nome", tipo: "text", obrigatorio: true, lista: true },
      { nome: "email", rotulo: "Email", tipo: "email", obrigatorio: true, lista: true },
      { nome: "papel", rotulo: "Papel", tipo: "select", opcoes: ["membro", "admin"], obrigatorio: true, lista: true },
      { nome: "password", rotulo: "Palavra-passe (mín. 8)", tipo: "password", soNovo: true },
    ],
  },
  definicoes: {
    titulo: "Definições", estado: null, colecao: "definicoes",
    ajuda: "Parâmetros gerais da aplicação.",
    campos: [
      { nome: "chave", rotulo: "Chave", tipo: "text", obrigatorio: true, lista: true, fixoAoEditar: true },
      { nome: "valor", rotulo: "Valor", tipo: "text", lista: true },
      { nome: "descricao", rotulo: "Descrição", tipo: "text", lista: true },
    ],
  },
}

let separador = lerLocal("orc_config_sep", "categorias")

export function render(el) {
  const admin = isAdmin()
  const seps = [...Object.entries(TABELAS).filter(([, t]) => !t.soAdmin || admin).map(([k, t]) => [k, t.titulo]), ["perfil", "O meu perfil"]]
  if (!seps.some(([k]) => k === separador)) separador = "categorias"

  el.append(
    h("div", { class: "pagina-topo" }, h("h1", {}, "Configurar")),
    h("div", { class: "separadores", role: "tablist" }, seps.map(([k, t]) => h("button", {
      role: "tab", "aria-selected": String(k === separador),
      onclick: () => { separador = k; gravarLocal("orc_config_sep", k); emitir() },
    }, t))),
  )
  if (separador === "perfil") return el.append(perfil(), seccaoPasskeys())

  const t = TABELAS[separador]
  const podeCriar = admin || (t.qualquer || []).includes("create")
  const zona = h("section", { class: "cartao" })
  el.append(zona)

  const desenharTabela = (lista) => {
    zona.innerHTML = ""
    const colunas = t.campos.filter((c) => c.lista)
    zona.append(...[
      h("header", { class: "cartao-topo" },
        h("div", {}, h("h3", {}, t.titulo), t.ajuda ? h("p", { class: "sub" }, t.ajuda) : null),
        podeCriar ? h("button", { class: "btn btn-primario", onclick: () => abrirEditor(separador, null) }, "Adicionar") : null),
      !admin ? h("p", { class: "nota-admin" }, "Só administradores podem alterar estes dados.") : null,
      h("div", { class: "tabela-scroll" }, h("table", { class: `tabela ${admin ? "tabela-clicavel" : ""}` },
        h("thead", {}, h("tr", {}, colunas.map((c) => h("th", { class: c.tipo === "number" ? "num" : "" }, c.rotulo)))),
        h("tbody", {}, [...lista].sort(t.ordem || (() => 0)).map((r) => h("tr", {
          tabindex: admin ? 0 : -1,
          class: r.ativo === false ? "apagado" : "",
          onclick: () => admin && abrirEditor(separador, r),
          onkeydown: (e) => admin && e.key === "Enter" && abrirEditor(separador, r),
        }, colunas.map((c) => h("td", { class: c.tipo === "number" ? "num" : "" }, mostrar(c, r[c.nome]))))))))].filter(Boolean))
  }

  if (t.estado) desenharTabela(state[t.estado])
  else {
    zona.append(h("p", { class: "vazio" }, "A carregar…"))
    pb.collection(t.colecao).getFullList({ sort: "chave" }).then(desenharTabela)
      .catch((err) => { zona.innerHTML = ""; zona.append(h("p", { class: "erro" }, erroTexto(err))) })
  }
}

function mostrar(c, v) {
  if (c.tipo === "bool") return v ? "Sim" : "Não"
  if (c.tipo === "select") return rotulo(v)
  if (c.tipo === "relacao") return nomeDe(state[c.fonte], v)
  if (c.moeda) return v ? eur(v) : "–"
  return v ?? ""
}

function abrirEditor(chave, r) {
  const t = TABELAS[chave]
  const colecao = t.colecao || chave
  const erro = h("p", { class: "erro", role: "alert" })
  const entradas = {}
  const campos = t.campos.filter((c) => !(c.soNovo && r)).map((c) => {
    const v = r ? r[c.nome] : c.omissao
    let input
    if (c.tipo === "select") {
      input = h("select", { name: c.nome, required: c.obrigatorio },
        c.obrigatorio ? null : h("option", { value: "" }, "—"),
        c.opcoes.map((o) => h("option", { value: o, selected: v === o }, rotulo(o))))
    } else if (c.tipo === "relacao") {
      input = h("select", { name: c.nome }, h("option", { value: "" }, "—"),
        state[c.fonte].map((o) => h("option", { value: o.id, selected: v === o.id }, o.nome)))
    } else if (c.tipo === "bool") {
      input = h("input", { type: "checkbox", name: c.nome, checked: v })
      entradas[c.nome] = input
      return h("label", { class: "campo-check" }, input, c.rotulo)
    } else {
      const lid = c.sugestoes ? `sug-${c.nome}` : null
      input = h("input", {
        name: c.nome, type: c.tipo === "number" ? "number" : c.tipo, step: c.tipo === "number" ? "0.01" : null,
        required: c.obrigatorio, value: v ?? "", list: lid, readonly: c.fixoAoEditar && r ? true : null,
        minlength: c.tipo === "password" ? 8 : null, autocomplete: c.tipo === "password" ? "new-password" : null,
      })
      if (lid) input = [input, h("datalist", { id: lid }, c.sugestoes().map((s) => h("option", { value: s })))]
    }
    entradas[c.nome] = Array.isArray(input) ? input[0] : input
    return h("label", { class: "campo" }, h("span", {}, c.rotulo), input)
  })

  const novaPass = chave === "users" && r ? h("label", { class: "campo" }, h("span", {}, "Nova palavra-passe (deixe vazio para manter)"),
    h("input", { name: "nova_password", type: "password", minlength: 8, autocomplete: "new-password" })) : null

  const podeEliminar = r && !(chave === "users" && r.id === pb.authStore.record?.id)
  const form = h("form", { class: "form" }, campos, novaPass, erro,
    h("div", { class: "acoes" },
      podeEliminar ? h("button", { type: "button", class: "btn btn-perigo-texto", onclick: eliminar }, "Eliminar") : null,
      h("span", { class: "espaco" }),
      h("button", { type: "submit", class: "btn btn-primario" }, "Guardar")))

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    erro.textContent = ""
    const dados = {}
    for (const c of t.campos) {
      const i = entradas[c.nome]
      if (!i) continue
      if (c.tipo === "bool") dados[c.nome] = i.checked
      else if (c.tipo === "number") dados[c.nome] = i.value === "" ? 0 : Number(i.value)
      else dados[c.nome] = i.value
    }
    if (chave === "users") {
      if (!r) { dados.passwordConfirm = dados.password; dados.verified = true }
      const np = form.querySelector("[name=nova_password]")?.value
      if (np) { dados.password = np; dados.passwordConfirm = np }
    }
    try {
      if (r) await pb.collection(colecao).update(r.id, dados)
      else await pb.collection(colecao).create(dados)
      fecharModal()
      aviso("Guardado.", "ok")
      await recarregar()
    } catch (err) { erro.textContent = erroTexto(err) }
  })

  async function eliminar() {
    const aviso2 = ["categorias", "fornecedores", "metodos_pagamento", "responsaveis"].includes(chave)
      ? " Se já tiver movimentos associados, é preferível desmarcar \"Ativo\" em vez de eliminar." : ""
    if (!(await confirmar(`Eliminar este registo?${aviso2}`, { sim: "Eliminar" }))) return
    try { await pb.collection(colecao).delete(r.id); fecharModal(); aviso("Eliminado.", "ok"); await recarregar() }
    catch (err) { aviso(`Não foi possível eliminar: ${erroTexto(err)}`, "erro") }
  }

  abrirModal(`${r ? "Editar" : "Adicionar"} · ${t.titulo}`, form)
}

function perfil() {
  const u = pb.authStore.record
  const erro = h("p", { class: "erro", role: "alert" })
  const form = h("form", { class: "form form-estreito" },
    h("label", { class: "campo" }, h("span", {}, "Nome"), h("input", { name: "name", value: u?.name || "", required: true })),
    h("label", { class: "campo" }, h("span", {}, "Email"), h("input", { value: u?.email || "", readonly: true })),
    h("label", { class: "campo" }, h("span", {}, "Palavra-passe atual (só para mudar a palavra-passe)"),
      h("input", { name: "oldPassword", type: "password", autocomplete: "current-password" })),
    h("label", { class: "campo" }, h("span", {}, "Nova palavra-passe"),
      h("input", { name: "password", type: "password", minlength: 8, autocomplete: "new-password" })),
    erro,
    h("div", { class: "acoes" }, h("span", { class: "espaco" }), h("button", { class: "btn btn-primario", type: "submit" }, "Guardar")))
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    erro.textContent = ""
    const fd = new FormData(form)
    const dados = { name: fd.get("name") }
    if (fd.get("password")) Object.assign(dados, { oldPassword: fd.get("oldPassword"), password: fd.get("password"), passwordConfirm: fd.get("password") })
    try {
      await pb.collection("users").update(u.id, dados)
      if (dados.password) await pb.collection("users").authWithPassword(u.email, dados.password)
      else await pb.collection("users").authRefresh()
      aviso("Perfil atualizado.", "ok")
      document.querySelector(".utilizador").textContent = pb.authStore.record?.name || ""
      form.reset()
      form.querySelector("[name=name]").value = pb.authStore.record?.name || ""
    } catch (err) { erro.textContent = erroTexto(err) }
  })
  return h("section", { class: "cartao" },
    h("header", { class: "cartao-topo" }, h("div", {}, h("h3", {}, "O meu perfil"),
      h("p", { class: "sub" }, `Papel: ${rotulo(u?.papel)} · Versão da app: ${VERSAO_APP}`))), form)
}
