// Núcleo: ligação ao servidor, estado partilhado, sincronização e utilitários de interface.
import PocketBase from "../vendor/pocketbase.es.mjs"

// Versão da app: atualizar aqui E em /versao.json a cada alteração publicada.
export const VERSAO_APP = "1.4"

export const pb = new PocketBase(location.origin)
pb.autoCancellation(false)

export const state = {
  cats: [], forn: [], metodos: [], resp: [], users: [], recs: [], movs: [],
  defs: {},
  ambito: lerLocal("orc_ambito", "todos"),
  online: navigator.onLine,
  carregado: false,
}

// ------------------------------------------------------------------ utilitários
export function lerLocal(chave, omissao) {
  try { const v = localStorage.getItem(chave); return v === null ? omissao : JSON.parse(v) } catch (_) { return omissao }
}
export function gravarLocal(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)) } catch (_) {}
}

const fmt = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" })
const fmt0 = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
export const eur = (v) => fmt.format(v || 0)
export const eur0 = (v) => fmt0.format(v || 0)

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
export const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

const pad = (n) => String(n).padStart(2, "0")
export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const mesAtual = () => hojeISO().slice(0, 7)
export function somarMesesYM(ym, n) {
  const [y, m] = ym.split("-").map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}
export const dataISO = (pbDate) => (pbDate || "").slice(0, 10)
export const paraPB = (iso) => `${iso} 12:00:00.000Z`
export function dataCurta(iso) {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
export function nomeMes(ym) {
  const [y, m] = ym.split("-").map(Number)
  return `${MESES_LONGOS[m - 1]} ${y}`
}
export const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

export const ROTULOS = {
  saida: "Despesa", entrada: "Receita", pessoal: "Pessoal", profissional: "Profissional",
  fixa: "Fixa", variavel: "Variável", admin: "Administrador", membro: "Membro",
  mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual",
}
export const rotulo = (v) => ROTULOS[v] || v || ""

// Construtor de elementos: h("div", {class: "x", onclick: fn}, filhos...)
export function h(tag, attrs, ...filhos) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v)
    else if (k === "html") el.innerHTML = v
    else if (k === "value") el.value = v
    else if (k === "checked") el.checked = !!v
    else el.setAttribute(k, v === true ? "" : v)
  }
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue
    el.append(f instanceof Node ? f : document.createTextNode(String(f)))
  }
  return el
}

export function aviso(texto, tipo = "info") {
  const zona = document.getElementById("avisos")
  const el = h("div", { class: `aviso aviso-${tipo}`, role: "status" }, texto)
  zona.append(el)
  setTimeout(() => el.classList.add("sair"), 3200)
  setTimeout(() => el.remove(), 3600)
}

export function erroTexto(err) {
  const d = err?.response?.data
  if (d && typeof d === "object") {
    const campos = Object.entries(d).map(([k, v]) => `${k}: ${v?.message || v}`)
    if (campos.length) return `${err.response.message || "Erro"} (${campos.join("; ")})`
  }
  return err?.response?.message || err?.message || String(err)
}

// ------------------------------------------------------------------ janela modal
// Proteção contra perda de dados: ao abrir, guarda-se uma "fotografia" do formulário; ao tentar
// sair (clicar fora, Esc, ✕, Duplicar…) compara-se com o estado atual e, se mudou, pergunta-se.
let modalAberto = false
let estadoInicial = ""
let painelAtual = null   // { el, nao } — painel de pergunta/confirmação mostrado dentro da janela
export const haModalAberto = () => modalAberto

function estadoModal() {
  const corpo = document.querySelector("#modal .modal-corpo")
  if (!corpo) return ""
  return JSON.stringify([...corpo.querySelectorAll("input, select, textarea, [aria-pressed]")].map((el) => {
    if (el.hasAttribute("aria-pressed")) return el.getAttribute("aria-pressed")
    if (el.type === "checkbox" || el.type === "radio") return el.checked
    if (el.type === "file") return [...el.files].map((f) => f.name).join("|")
    return el.value
  }))
}
export const modalComAlteracoes = () => modalAberto && estadoModal() !== estadoInicial

export function abrirModal(titulo, conteudo, { largo = false } = {}) {
  fecharModal()
  modalAberto = true
  const caixa = h("div", { class: `modal ${largo ? "modal-largo" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": titulo },
    h("header", { class: "modal-topo" },
      h("h2", {}, titulo),
      h("button", { class: "btn-icone", "aria-label": "Fechar", onclick: () => tentarFecharModal(), html: ICONES.fechar })),
    h("div", { class: "modal-corpo" }, conteudo))
  // clicar fora NÃO fecha a janela (evita perder registos por engano): só ✕, Esc ou os botões
  const fundo = h("div", { class: "modal-fundo", id: "modal", onclick: (e) => {
    if (e.target !== fundo) return
    caixa.classList.remove("modal-aviso")
    void caixa.offsetWidth          // reinicia a animação
    caixa.classList.add("modal-aviso")
  } }, caixa)
  document.body.append(fundo)
  document.body.classList.add("sem-scroll")
  estadoInicial = estadoModal()
  setTimeout(() => fundo.querySelector("input:not([type=hidden]), select, textarea")?.focus(), 50)
}

export function fecharModal() {
  painelAtual = null
  document.getElementById("modal")?.remove()
  document.body.classList.remove("sem-scroll")
  if (modalAberto) {
    modalAberto = false
    window.dispatchEvent(new CustomEvent("orc:modal-fechado"))
  }
}

// Mostra uma pergunta dentro da janela aberta (sem a fechar nem perder o que foi escrito).
function fecharPainel(executarNao) {
  const p = painelAtual
  painelAtual = null
  if (!p) return
  p.el.remove()
  if (executarNao) p.nao?.()
}
function mostrarPainel({ titulo, texto = "", sim, classeSim = "btn-perigo-texto", aoSim, nao = "Cancelar", aoNao }) {
  const caixa = document.querySelector("#modal .modal")
  if (!caixa) return false
  fecharPainel(true)
  const el = h("div", { class: "modal-pergunta", role: "alertdialog", "aria-label": titulo },
    h("p", {}, h("strong", {}, titulo), texto ? ` ${texto}` : ""),
    h("div", { class: "acoes" },
      h("button", { type: "button", class: `btn ${classeSim}`, onclick: () => { fecharPainel(false); aoSim() } }, sim),
      h("span", { class: "espaco" }),
      h("button", { type: "button", class: "btn btn-primario", onclick: () => fecharPainel(true) }, nao)))
  painelAtual = { el, nao: aoNao }
  caixa.append(el)
  el.querySelector(".btn-primario").focus()
  return true
}

// Executa "acao" (fechar, duplicar, abrir outra janela…) perguntando antes se há alterações por guardar.
export function sairDoModal(acao = fecharModal) {
  if (modalComAlteracoes()) {
    mostrarPainel({ titulo: "Tem alterações por guardar.", texto: "Quer sair sem guardar?", sim: "Sair sem guardar", aoSim: acao, nao: "Continuar a editar" })
  } else acao()
}
export const tentarFecharModal = () => sairDoModal(fecharModal)

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !modalAberto) return
  if (painelAtual) fecharPainel(true)
  else tentarFecharModal()
})

// Confirmação (ex.: eliminar). Com uma janela aberta, aparece dentro dela e, se cancelar,
// o formulário fica intacto; quem chama fecha a janela depois de concluir a ação.
export function confirmar(texto, { sim = "Confirmar" } = {}) {
  return new Promise((resolve) => {
    if (modalAberto && mostrarPainel({ titulo: texto, sim, classeSim: "btn-perigo", aoSim: () => resolve(true), aoNao: () => resolve(false) })) return
    const bSim = h("button", { class: "btn btn-perigo", onclick: () => { fecharModal(); resolve(true) } }, sim)
    const bNao = h("button", { class: "btn", onclick: () => { fecharModal(); resolve(false) } }, "Cancelar")
    abrirModal("Confirmar", h("div", {}, h("p", {}, texto), h("div", { class: "acoes" }, bNao, bSim)))
  })
}

// ------------------------------------------------------------------ ícones (SVG inline)
const svg = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`
export const ICONES = {
  painel: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  movimentos: svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  analise: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  previsao: svg('<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>'),
  recorrencias: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
  config: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  mais: svg('<path d="M12 5v14M5 12h14"/>'),
  fechar: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  esq: svg('<path d="M15 18l-6-6 6-6"/>'),
  dir: svg('<path d="M9 18l6-6-6-6"/>'),
  sair: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  clip: svg('<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>'),
  nuvem: svg('<path d="M1 1l22 22M16.7 16.7A5 5 0 0 1 18 17H7a5 5 0 0 1-1.4-9.8M9.6 4.6A7 7 0 0 1 18.9 10H19a4 4 0 0 1 3 6.7"/>'),
  editar: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  digital: svg('<path d="M12 11v3a8 8 0 0 1-1.5 4.7"/><path d="M8.5 6.5A6 6 0 0 1 18 11v2.5a14 14 0 0 1-.6 4"/><path d="M6 9.5A6 6 0 0 0 6 11v2a10 10 0 0 1-1.2 4.8"/><path d="M9 11a3 3 0 0 1 6 0v2a12 12 0 0 1-1.2 5.3"/><path d="M4.3 6.4A10 10 0 0 1 20 8"/>'),
  lixo: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
}

// ------------------------------------------------------------------ carregamento de dados
export const emitir = () => window.dispatchEvent(new CustomEvent("orc:dados"))

const LOOKUPS = [
  ["cats", "categorias", "ordem,nome"],
  ["forn", "fornecedores", "nome"],
  ["metodos", "metodos_pagamento", "nome"],
  ["resp", "responsaveis", "nome"],
  ["recs", "recorrencias", "proxima_data"],
  ["users", "users", "name"],
]

export function anoInicialDados() { return new Date().getFullYear() - 2 }

async function carregarTudo() {
  const pedidos = LOOKUPS.map(([, col, sort]) => pb.collection(col).getFullList({ sort, batch: 500 }))
  pedidos.push(pb.collection("definicoes").getFullList({ batch: 200 }))
  pedidos.push(pb.collection("movimentos").getFullList({
    filter: pb.filter("data >= {:d}", { d: `${anoInicialDados()}-01-01 00:00:00.000Z` }),
    sort: "-data,-created", batch: 1000,
  }))
  const res = await Promise.all(pedidos)
  LOOKUPS.forEach(([chave], i) => { state[chave] = res[i] })
  state.defs = Object.fromEntries(res[LOOKUPS.length].map((d) => [d.chave, d.valor]))
  state.movs = res[LOOKUPS.length + 1]
  state.carregado = true
  guardarCache()
}

function guardarCache() {
  const { cats, forn, metodos, resp, recs, users, movs, defs } = state
  gravarLocal("orc_cache", { cats, forn, metodos, resp, recs, users, movs, defs, em: Date.now() })
}

function lerCache() {
  const c = lerLocal("orc_cache", null)
  if (!c) return false
  Object.assign(state, c)
  state.carregado = true
  return true
}

export async function iniciarDados() {
  try {
    await carregarTudo()
  } catch (err) {
    if (!lerCache()) throw err
    aviso("Sem ligação: a mostrar os últimos dados guardados neste aparelho.", "aviso")
  }
  juntarPendentes()
  subscrever()
  await enviarPendentes()
}

export async function recarregar() {
  try { await carregarTudo(); juntarPendentes(); emitir() } catch (_) {}
}

// Atualizações em tempo real: quando outro utilizador/aparelho altera dados, a app atualiza sozinha.
let subscrito = false
function subscrever() {
  if (subscrito) return
  subscrito = true
  const mapa = { categorias: "cats", fornecedores: "forn", metodos_pagamento: "metodos", responsaveis: "resp", recorrencias: "recs", users: "users", movimentos: "movs" }
  for (const [col, chave] of Object.entries(mapa)) {
    pb.collection(col).subscribe("*", (e) => {
      const lista = state[chave]
      const i = lista.findIndex((r) => r.id === e.record.id)
      if (e.action === "delete") { if (i >= 0) lista.splice(i, 1) }
      else if (i >= 0) lista[i] = e.record
      else lista.unshift(e.record)
      if (chave === "movs") lista.sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      guardarCache()
      emitir()
    }).catch(() => {})
  }
  pb.collection("definicoes").subscribe("*", () => recarregar()).catch(() => {})
}

export function pararSubscricoes() {
  subscrito = false
  pb.realtime.unsubscribe().catch(() => {})
}

// ------------------------------------------------------------------ fila sem rede
// Movimentos criados sem ligação ficam guardados no aparelho e são enviados quando a rede voltar.
function fila() { return lerLocal("orc_fila", []) }

function juntarPendentes() {
  for (const p of fila()) {
    if (!state.movs.some((m) => m.id === p.id)) state.movs.unshift({ ...p, _pendente: true })
  }
  state.movs.sort((a, b) => (b.data || "").localeCompare(a.data || ""))
}

let aEnviar = null
export function enviarPendentes() {
  // evita envios em simultâneo (ex.: evento "online" + regresso à app), que duplicariam movimentos
  if (!aEnviar) aEnviar = enviarFila().finally(() => { aEnviar = null })
  return aEnviar
}

async function enviarFila() {
  const pendentes = fila()
  if (!pendentes.length || !navigator.onLine) return
  let enviados = 0
  for (const p of pendentes) {
    const { id, _pendente, ...dados } = p
    try {
      await pb.collection("movimentos").create(dados)
      state.movs = state.movs.filter((m) => m.id !== id)
      gravarLocal("orc_fila", fila().filter((x) => x.id !== id))
      enviados++
    } catch (err) {
      if (err?.status && err.status >= 400 && err.status < 500) {
        aviso(`Movimento pendente rejeitado: ${erroTexto(err)}`, "erro")
        state.movs = state.movs.filter((m) => m.id !== id)
        gravarLocal("orc_fila", fila().filter((x) => x.id !== id))
      }
      // erro de rede: fica na fila para a próxima tentativa
    }
  }
  if (enviados) { aviso(`${enviados} movimento(s) sincronizado(s).`, "ok"); await recarregar() }
}

export async function guardarMovimento(id, dados) {
  const temFicheiros = dados instanceof FormData
  try {
    return id
      ? await pb.collection("movimentos").update(id, dados)
      : await pb.collection("movimentos").create(dados)
  } catch (err) {
    const semRede = !err?.status || err.status === 0
    if (semRede && !id && !temFicheiros) {
      const tmp = { ...dados, id: `pendente_${Date.now()}` }
      gravarLocal("orc_fila", [...fila(), tmp])
      state.movs.unshift({ ...tmp, _pendente: true })
      emitir()
      aviso("Sem ligação: o movimento fica guardado e será enviado quando houver rede.", "aviso")
      return tmp
    }
    throw err
  }
}

export function removerPendente(id) {
  gravarLocal("orc_fila", fila().filter((p) => p.id !== id))
  state.movs = state.movs.filter((m) => m.id !== id)
  emitir()
}

window.addEventListener("online", () => { state.online = true; document.body.classList.remove("offline"); enviarPendentes(); recarregar() })
window.addEventListener("offline", () => { state.online = false; document.body.classList.add("offline") })

// ------------------------------------------------------------------ consultas
export const porId = (lista, id) => lista.find((r) => r.id === id)
export const cat = (id) => porId(state.cats, id)
export const nomeDe = (lista, id) => porId(lista, id)?.nome || ""
export const isAdmin = () => pb.authStore.record?.papel === "admin"
export const def = (chave, omissao) => state.defs[chave] ?? omissao

export function movsFiltrados() {
  return state.ambito === "todos" ? state.movs : state.movs.filter((m) => m.ambito === state.ambito)
}
export function recsFiltradas() {
  const ativas = state.recs.filter((r) => r.ativo)
  return state.ambito === "todos" ? ativas : ativas.filter((r) => r.ambito === state.ambito)
}

export function setAmbito(v) {
  state.ambito = v
  gravarLocal("orc_ambito", v)
  emitir()
}

// Cores das séries (lidas do CSS para respeitar o modo claro/escuro).
export function cor(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${nome}`).trim()
}
