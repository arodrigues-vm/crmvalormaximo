// Formulário de criação/edição de movimentos.
import {
  pb, state, h, abrirModal, fecharModal, aviso, erroTexto, confirmar, guardarMovimento, removerPendente,
  hojeISO, dataISO, paraPB, normalizar, lerLocal, gravarLocal, nomeDe, ICONES, emitir,
} from "../core.js"

export function opcoesCategorias(select, tipo, selecionada) {
  select.innerHTML = ""
  select.append(h("option", { value: "" }, "— escolher —"))
  const grupos = {}
  for (const c of state.cats) {
    if (c.tipo !== tipo || (!c.ativo && c.id !== selecionada)) continue
    ;(grupos[c.grupo || "Outras"] ||= []).push(c)
  }
  for (const [g, lista] of Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0], "pt"))) {
    select.append(h("optgroup", { label: g }, lista.map((c) =>
      h("option", { value: c.id, selected: c.id === selecionada }, c.nome))))
  }
}

export function selectSimples(nome, lista, selecionado, vazio = "—") {
  return h("select", { name: nome },
    h("option", { value: "" }, vazio),
    lista.filter((r) => r.ativo || r.id === selecionado)
      .map((r) => h("option", { value: r.id, selected: r.id === selecionado }, r.nome)))
}

// Garante que o fornecedor escrito existe (cria-o se for novo). Devolve o id ou "".
export async function resolverFornecedor(nome, categoriaId) {
  const n = normalizar(nome)
  if (!n) return ""
  const existente = state.forn.find((f) => normalizar(f.nome) === n)
  if (existente) return existente.id
  const novo = await pb.collection("fornecedores").create({ nome: nome.trim(), categoria_padrao: categoriaId || "", ativo: true })
  state.forn.push(novo)
  return novo.id
}

export function abrirFormMovimento(mov = null, { duplicar = false } = {}) {
  const editar = !!mov && !duplicar
  const ultimo = lerLocal("orc_ultimos", {})
  const m = mov || {
    tipo: "saida", data: paraPB(hojeISO()), pago: true,
    ambito: state.ambito === "todos" ? "" : state.ambito,
    metodo_pagamento: ultimo.metodo || "", responsavel: ultimo.responsavel || "",
  }
  let tipo = m.tipo || "saida"

  const selCat = h("select", { name: "categoria", required: true })
  opcoesCategorias(selCat, tipo, m.categoria)

  const selAmbito = h("select", { name: "ambito", required: true },
    h("option", { value: "" }, "— escolher —"),
    h("option", { value: "pessoal", selected: m.ambito === "pessoal" }, "Pessoal"),
    h("option", { value: "profissional", selected: m.ambito === "profissional" }, "Profissional"))

  const inForn = h("input", { name: "fornecedor_nome", list: "lista-fornecedores", autocomplete: "off",
    value: nomeDe(state.forn, m.fornecedor), placeholder: "Escreva ou escolha" })
  const datalist = h("datalist", { id: "lista-fornecedores" },
    state.forn.filter((f) => f.ativo).map((f) => h("option", { value: f.nome })))

  const aplicarAmbitoDaCategoria = () => {
    const c = state.cats.find((x) => x.id === selCat.value)
    if (c?.ambito_padrao && !selAmbito.value) selAmbito.value = c.ambito_padrao
  }
  selCat.addEventListener("change", aplicarAmbitoDaCategoria)
  inForn.addEventListener("change", () => {
    const f = state.forn.find((x) => normalizar(x.nome) === normalizar(inForn.value))
    const c = f && state.cats.find((x) => x.id === f.categoria_padrao)
    if (c && c.tipo === tipo && !selCat.value) { selCat.value = c.id; aplicarAmbitoDaCategoria() }
  })

  const botoesTipo = h("div", { class: "segmentado segmentado-largo", role: "group", "aria-label": "Tipo" },
    [["saida", "Despesa"], ["entrada", "Receita"]].map(([v, t]) => h("button", {
      type: "button", "data-v": v, "aria-pressed": String(tipo === v),
      onclick: () => {
        tipo = v
        botoesTipo.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)))
        opcoesCategorias(selCat, tipo, "")
      },
    }, t)))

  const anexosAtuais = editar && m.anexo?.length
    ? h("div", { class: "anexos" }, m.anexo.map((nome) => h("button", {
      type: "button", class: "chip",
      onclick: async () => {
        const token = await pb.files.getToken()
        window.open(pb.files.getURL(m, nome, { token }), "_blank", "noopener")
      },
    }, h("span", { html: ICONES.clip }), nome.replace(/_[a-z0-9]{10}(\.\w+)$/i, "$1"))))
    : null

  const inFicheiros = h("input", { type: "file", name: "anexo", multiple: true, accept: "image/*,application/pdf" })
  const erro = h("p", { class: "erro", role: "alert" })

  const form = h("form", { class: "form", novalidate: false },
    botoesTipo,
    h("div", { class: "grelha-2" },
      h("label", { class: "campo" }, h("span", {}, "Data"),
        h("input", { type: "date", name: "data", required: true, value: dataISO(m.data) || hojeISO() })),
      h("label", { class: "campo" }, h("span", {}, "Valor (€)"),
        h("input", { type: "number", name: "valor", required: true, min: "0.01", step: "0.01", inputmode: "decimal", value: m.valor ?? "" }))),
    h("label", { class: "campo" }, h("span", {}, "Categoria"), selCat),
    h("div", { class: "grelha-2" },
      h("label", { class: "campo" }, h("span", {}, "Fornecedor / Entidade"), inForn, datalist),
      h("label", { class: "campo" }, h("span", {}, "Âmbito"), selAmbito)),
    h("div", { class: "grelha-2" },
      h("label", { class: "campo" }, h("span", {}, "Método de pagamento"), selectSimples("metodo_pagamento", state.metodos, m.metodo_pagamento)),
      h("label", { class: "campo" }, h("span", {}, "Responsável"), selectSimples("responsavel", state.resp, m.responsavel))),
    h("label", { class: "campo" }, h("span", {}, "Descrição"),
      h("input", { name: "descricao", maxlength: 300, value: m.descricao || "" })),
    h("label", { class: "campo-check" }, h("input", { type: "checkbox", name: "pago", checked: m.pago !== false }), "Pago / recebido"),
    h("label", { class: "campo" }, h("span", {}, "Anexos (fatura, recibo — foto ou PDF)"), anexosAtuais, inFicheiros),
    erro,
    h("div", { class: "acoes" },
      editar ? h("button", { type: "button", class: "btn btn-perigo-texto", onclick: eliminar }, "Eliminar") : null,
      editar ? h("button", { type: "button", class: "btn", onclick: () => abrirFormMovimento(m, { duplicar: true }) }, "Duplicar") : null,
      h("span", { class: "espaco" }),
      editar ? null : h("button", { type: "submit", class: "btn", value: "novo" }, "Guardar e novo"),
      h("button", { type: "submit", class: "btn btn-primario", value: "fechar" }, "Guardar")))

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    erro.textContent = ""
    const fd = new FormData(form)
    if (!fd.get("categoria")) { erro.textContent = "Escolha a categoria."; return }
    if (!fd.get("ambito")) { erro.textContent = "Escolha o âmbito (pessoal ou profissional)."; return }
    const botoes = form.querySelectorAll("button")
    botoes.forEach((b) => (b.disabled = true))
    try {
      const fornecedor = navigator.onLine ? await resolverFornecedor(fd.get("fornecedor_nome"), fd.get("categoria")) : (
        state.forn.find((f) => normalizar(f.nome) === normalizar(fd.get("fornecedor_nome")))?.id || "")
      const dados = {
        data: paraPB(fd.get("data")), tipo, ambito: fd.get("ambito"), categoria: fd.get("categoria"),
        valor: Number(fd.get("valor")), fornecedor, metodo_pagamento: fd.get("metodo_pagamento"),
        responsavel: fd.get("responsavel"), pago: fd.get("pago") === "on", descricao: fd.get("descricao") || "",
      }
      const ficheiros = inFicheiros.files
      let envio = dados
      if (ficheiros.length) {
        envio = new FormData()
        for (const [k, v] of Object.entries(dados)) envio.append(k, typeof v === "boolean" ? String(v) : v)
        for (const f of ficheiros) envio.append(editar ? "anexo+" : "anexo", f)
      }
      if (editar && m._pendente) { removerPendente(m.id); await guardarMovimento(null, envio) }
      else await guardarMovimento(editar ? m.id : null, envio)
      gravarLocal("orc_ultimos", { metodo: dados.metodo_pagamento, responsavel: dados.responsavel })
      aviso(editar ? "Movimento atualizado." : "Movimento registado.", "ok")
      if (e.submitter?.value === "novo") {
        abrirFormMovimento({ ...m, ...dados, valor: "", descricao: "", fornecedor: "", categoria: "", id: undefined }, { duplicar: true })
      } else fecharModal()
    } catch (err) {
      erro.textContent = erroTexto(err)
    } finally {
      botoes.forEach((b) => (b.disabled = false))
    }
  })

  async function eliminar() {
    if (!(await confirmar("Eliminar este movimento? Esta ação não pode ser desfeita."))) return
    try {
      if (m._pendente) removerPendente(m.id)
      else {
        await pb.collection("movimentos").delete(m.id)
        state.movs = state.movs.filter((x) => x.id !== m.id)
        emitir()
      }
      aviso("Movimento eliminado.", "ok")
    } catch (err) { aviso(erroTexto(err), "erro") }
  }

  abrirModal(editar ? "Editar movimento" : (duplicar && mov?.id ? "Duplicar movimento" : "Novo movimento"), form)
}
