// Lista de movimentos com filtros, exportação e importação (CSV).
import {
  pb, state, h, eur, esc, dataCurta, dataISO, mesAtual, nomeMes, movsFiltrados, nomeDe, rotulo, ICONES,
  normalizar, paraPB, aviso, erroTexto, abrirModal, fecharModal, lerLocal, gravarLocal, emitir, recarregar,
} from "../core.js"
import { abrirFormMovimento, resolverFornecedor } from "./form-movimento.js"
import { navegadorMes, botaoNovo } from "./painel.js"

const filtros = Object.assign(
  { periodo: "mes", mes: mesAtual(), ano: String(new Date().getFullYear()), tipo: "", categoria: "", responsavel: "", estado: "", texto: "" },
  lerLocal("orc_filtros_mov", {}),
  { mes: mesAtual() },
)
const guardarFiltros = () => gravarLocal("orc_filtros_mov", { ...filtros, mes: undefined })

export function linhaMovimento(m) {
  const c = state.cats.find((x) => x.id === m.categoria)
  const forn = nomeDe(state.forn, m.fornecedor)
  const detalhe = [forn, m.descricao].filter(Boolean).join(" · ")
  return h("li", {},
    h("button", { class: "mov", onclick: () => abrirFormMovimento(m) },
      h("span", { class: "mov-data" }, dataCurta(dataISO(m.data)).slice(0, 5)),
      h("span", { class: "mov-info" },
        h("span", { class: "mov-cat" }, c?.nome || "(sem categoria)"),
        h("span", { class: "mov-det" }, detalhe || " "),
        h("span", { class: "etiquetas" },
          m.ambito === "profissional" ? h("span", { class: "etiqueta" }, "Profissional") : null,
          !m.pago ? h("span", { class: "etiqueta etiqueta-alerta" }, m.tipo === "entrada" ? "Por receber" : "Por pagar") : null,
          m._pendente ? h("span", { class: "etiqueta etiqueta-info" }, "A sincronizar") : null,
          m.anexo?.length ? h("span", { class: "etiqueta-icone", title: "Tem anexo", html: ICONES.clip }) : null)),
      h("span", { class: `mov-valor ${m.tipo === "entrada" ? "entrada" : ""}` }, `${m.tipo === "entrada" ? "+" : "−"}${eur(m.valor)}`)))
}

function aplicarFiltros() {
  const t = normalizar(filtros.texto)
  return movsFiltrados().filter((m) => {
    const d = dataISO(m.data)
    if (filtros.periodo === "mes" && !d.startsWith(filtros.mes)) return false
    if (filtros.periodo === "ano" && !d.startsWith(filtros.ano)) return false
    if (filtros.tipo && m.tipo !== filtros.tipo) return false
    if (filtros.categoria && m.categoria !== filtros.categoria) return false
    if (filtros.responsavel && m.responsavel !== filtros.responsavel) return false
    if (filtros.estado === "pago" && !m.pago) return false
    if (filtros.estado === "porpagar" && m.pago) return false
    if (t) {
      const alvo = normalizar([nomeDe(state.cats, m.categoria), nomeDe(state.forn, m.fornecedor), m.descricao, m.valor].join(" "))
      if (!alvo.includes(t)) return false
    }
    return true
  })
}

const mudar = (chave) => (e) => { filtros[chave] = e.target.value; guardarFiltros(); emitir() }

export function render(el) {
  const lista = aplicarFiltros()
  const soma = (tipo) => lista.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.valor), 0)
  const anos = []
  for (let a = new Date().getFullYear() + 1; a >= new Date().getFullYear() - 2; a--) anos.push(String(a))

  const pesquisa = h("input", { type: "search", placeholder: "Pesquisar…", value: filtros.texto, "aria-label": "Pesquisar" })
  let t
  pesquisa.addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { filtros.texto = e.target.value; emitir() }, 300) })

  el.append(
    h("div", { class: "pagina-topo" }, h("h1", {}, "Movimentos"),
      h("div", { class: "acoes-topo" },
        h("button", { class: "btn", onclick: () => exportarCSV(lista) }, "Exportar"),
        h("button", { class: "btn", onclick: abrirImportacao }, "Importar"))),
    h("div", { class: "filtros" },
      h("select", { "aria-label": "Período", onchange: mudar("periodo") },
        [["mes", "Mês"], ["ano", "Ano"], ["tudo", "Tudo"]].map(([v, l]) => h("option", { value: v, selected: filtros.periodo === v }, l))),
      filtros.periodo === "mes" ? navegadorMes(filtros.mes, (v) => { filtros.mes = v; emitir() }) : null,
      filtros.periodo === "ano" ? h("select", { "aria-label": "Ano", onchange: mudar("ano") }, anos.map((a) => h("option", { selected: a === filtros.ano }, a))) : null,
      h("select", { "aria-label": "Tipo", onchange: mudar("tipo") },
        [["", "Despesas e receitas"], ["saida", "Despesas"], ["entrada", "Receitas"]].map(([v, l]) => h("option", { value: v, selected: filtros.tipo === v }, l))),
      h("select", { "aria-label": "Categoria", onchange: mudar("categoria") },
        h("option", { value: "" }, "Todas as categorias"),
        state.cats.map((c) => h("option", { value: c.id, selected: filtros.categoria === c.id }, c.nome))),
      h("select", { "aria-label": "Responsável", onchange: mudar("responsavel") },
        h("option", { value: "" }, "Todos os responsáveis"),
        state.resp.map((r) => h("option", { value: r.id, selected: filtros.responsavel === r.id }, r.nome))),
      h("select", { "aria-label": "Estado", onchange: mudar("estado") },
        [["", "Pagos e por pagar"], ["pago", "Pagos"], ["porpagar", "Por pagar"]].map(([v, l]) => h("option", { value: v, selected: filtros.estado === v }, l))),
      pesquisa),
    h("div", { class: "resumo" },
      h("span", {}, `${lista.length} movimento(s)`),
      h("span", {}, "Receitas ", h("strong", {}, eur(soma("entrada")))),
      h("span", {}, "Despesas ", h("strong", {}, eur(soma("saida")))),
      h("span", {}, "Saldo ", h("strong", {}, eur(soma("entrada") - soma("saida"))))),
  )

  if (!lista.length) {
    el.append(h("section", { class: "cartao" }, h("p", { class: "vazio" }, "Nenhum movimento encontrado com estes filtros.")))
  } else {
    // agrupa por mês quando a vista abrange vários meses
    const grupos = {}
    for (const m of lista) (grupos[dataISO(m.data).slice(0, 7)] ||= []).push(m)
    for (const [k, ms] of Object.entries(grupos)) {
      el.append(h("section", { class: "cartao cartao-lista" },
        filtros.periodo !== "mes" ? h("h3", { class: "lista-titulo" }, nomeMes(k)) : null,
        h("ul", { class: "lista-mov" }, ms.map(linhaMovimento))))
    }
  }
  el.append(botaoNovo())
}

// ------------------------------------------------------------------ exportar
function csvCampo(v) {
  const s = String(v ?? "")
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const decimal = (v) => (Number(v) || 0).toFixed(2).replace(".", ",")

export function exportarCSV(lista) {
  const cab = ["Data", "Tipo", "Categoria", "Grupo", "Natureza", "Ambito", "Valor", "Fornecedor", "Metodo", "Responsavel", "Pago", "Descricao"]
  const linhas = lista.map((m) => {
    const c = state.cats.find((x) => x.id === m.categoria)
    return [dataCurta(dataISO(m.data)), rotulo(m.tipo), c?.nome, c?.grupo, rotulo(c?.natureza), rotulo(m.ambito), decimal(m.valor),
      nomeDe(state.forn, m.fornecedor), nomeDe(state.metodos, m.metodo_pagamento), nomeDe(state.resp, m.responsavel),
      m.pago ? "Sim" : "Não", m.descricao]
  })
  const texto = "﻿" + [cab, ...linhas].map((l) => l.map(csvCampo).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }))
  const a = h("a", { href: url, download: `movimentos-${new Date().toISOString().slice(0, 10)}.csv` })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ------------------------------------------------------------------ importar
export function lerCSV(texto) {
  texto = texto.replace(/^﻿/, "")
  const primeira = texto.split(/\r?\n/)[0] || ""
  const sep = [";", "\t", ","].map((s) => [s, primeira.split(s).length]).sort((a, b) => b[1] - a[1])[0][0]
  const linhas = []
  let linha = [], campo = "", aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') aspas = false
      else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++
      linha.push(campo); campo = ""
      if (linha.some((c) => c.trim())) linhas.push(linha)
      linha = []
    } else campo += ch
  }
  linha.push(campo)
  if (linha.some((c) => c.trim())) linhas.push(linha)
  return linhas
}

// nomes de colunas aceites (inclui os da folha Orçamento.xlsx)
const ALIASES = {
  data: ["data", "date"],
  tipo: ["tipo", "tipo_movimentos", "tipo movimento"],
  categoria: ["categoria", "categoria_movimentos"],
  valor: ["valor", "montante", "importancia"],
  ambito: ["ambito", "pessoal/profissional"],
  fornecedor: ["fornecedor", "fornecedores", "entidade"],
  metodo: ["metodo", "metodos_pagamento", "metodo de pagamento", "metodo_pagamento"],
  responsavel: ["responsavel", "responsaveis"],
  pago: ["pago", "estado"],
  descricao: ["descricao", "observacoes", "notas"],
}

function lerData(s) {
  s = String(s || "").trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return null
}
function lerValor(s) {
  s = String(s || "").replace(/[€\s]/g, "")
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".")
  else s = s.replace(/,/g, "")
  return Math.abs(Number(s))
}
const sim = (s) => ["sim", "s", "true", "1", "x", "yes", "pago", "recebido", "verdadeiro"].includes(normalizar(s))
const procurar = (lista, nome) => lista.find((r) => normalizar(r.nome) === normalizar(nome))

function abrirImportacao() {
  const input = h("input", { type: "file", accept: ".csv,text/csv,text/plain" })
  const info = h("div", { class: "importar-info" })
  const btn = h("button", { class: "btn btn-primario", disabled: true }, "Importar")
  let preparados = []

  input.addEventListener("change", async () => {
    const f = input.files[0]
    if (!f) return
    const linhas = lerCSV(await f.text())
    const cab = linhas.shift().map(normalizar)
    const idx = {}
    for (const [k, nomes] of Object.entries(ALIASES)) idx[k] = cab.findIndex((c) => nomes.includes(c))
    if (idx.data < 0 || idx.valor < 0 || idx.categoria < 0) {
      info.innerHTML = `<p class="erro">O ficheiro tem de ter pelo menos as colunas Data, Categoria e Valor.</p>`
      return
    }
    const erros = []
    preparados = []
    linhas.forEach((l, i) => {
      const g = (k) => (idx[k] >= 0 ? (l[idx[k]] || "").trim() : "")
      const c = procurar(state.cats, g("categoria"))
      const data = lerData(g("data"))
      const valor = lerValor(g("valor"))
      if (!c) return erros.push(`Linha ${i + 2}: categoria "${esc(g("categoria"))}" não existe`)
      if (!data) return erros.push(`Linha ${i + 2}: data inválida "${esc(g("data"))}"`)
      if (!valor) return erros.push(`Linha ${i + 2}: valor inválido`)
      const tipoTxt = normalizar(g("tipo"))
      const tipo = ["entrada", "receita"].includes(tipoTxt) ? "entrada" : ["saida", "despesa"].includes(tipoTxt) ? "saida" : c.tipo
      if (tipo !== c.tipo) return erros.push(`Linha ${i + 2}: "${esc(c.nome)}" não é categoria de ${tipo === "entrada" ? "receita" : "despesa"}`)
      const amb = normalizar(g("ambito"))
      preparados.push({
        data: paraPB(data), tipo, categoria: c.id, valor,
        ambito: amb.startsWith("prof") ? "profissional" : amb.startsWith("pess") ? "pessoal" : (c.ambito_padrao || "pessoal"),
        _fornecedor: g("fornecedor"),
        metodo_pagamento: procurar(state.metodos, g("metodo"))?.id || "",
        responsavel: procurar(state.resp, g("responsavel"))?.id || "",
        pago: idx.pago >= 0 ? sim(g("pago")) : true,
        descricao: g("descricao"),
      })
    })
    info.innerHTML = ""
    info.append(...[h("p", {}, h("strong", {}, `${preparados.length} movimento(s) prontos a importar.`)),
      erros.length ? h("details", {}, h("summary", {}, `${erros.length} linha(s) ignoradas`),
        h("ul", { class: "lista-erros", html: erros.map((e) => `<li>${e}</li>`).join("") })) : null].filter(Boolean))
    btn.disabled = !preparados.length
  })

  btn.addEventListener("click", async () => {
    btn.disabled = true
    let ok = 0
    try {
      for (const p of preparados) {
        const { _fornecedor, ...dados } = p
        dados.fornecedor = await resolverFornecedor(_fornecedor, dados.categoria)
        await pb.collection("movimentos").create(dados)
        ok++
        btn.textContent = `A importar… ${ok}/${preparados.length}`
      }
      aviso(`${ok} movimento(s) importados.`, "ok")
      fecharModal()
      await recarregar()
    } catch (err) {
      aviso(`Importação parada após ${ok} movimento(s): ${erroTexto(err)}`, "erro")
      btn.disabled = false
    }
  })

  abrirModal("Importar movimentos", h("div", { class: "form" },
    h("p", {}, "Escolha um ficheiro CSV (no Excel: Guardar como → CSV). Colunas reconhecidas: ",
      h("code", {}, "Data; Tipo; Categoria; Valor; Ambito; Fornecedor; Metodo; Responsavel; Pago; Descricao"),
      ". Os nomes das colunas da sua folha Orçamento.xlsx também são aceites. Categorias têm de existir; fornecedores novos são criados."),
    input, info, h("div", { class: "acoes" }, h("span", { class: "espaco" }), btn)))
}
