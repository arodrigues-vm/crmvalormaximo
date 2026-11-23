// Arranque, autenticação, navegação e estrutura da página.
import {
  pb, state, h, ICONES, aviso, erroTexto, iniciarDados, pararSubscricoes, haModalAberto,
  setAmbito, def, isAdmin, enviarPendentes,
} from "./core.js"
import { destruirGraficos } from "./graficos.js"
import * as painel from "./views/painel.js"
import * as movimentos from "./views/movimentos.js"
import * as analise from "./views/analise.js"
import * as previsao from "./views/previsao.js"
import * as recorrencias from "./views/recorrencias.js"
import * as config from "./views/config.js"
import { passkeyDisponivel, entrarComPasskey, proporAtivacao, bloqueioAtivo, textoErroPasskey } from "./passkey.js"

const ROTAS = [
  { id: "painel", titulo: "Painel", icone: ICONES.painel, vista: painel },
  { id: "movimentos", titulo: "Movimentos", icone: ICONES.movimentos, vista: movimentos },
  { id: "analise", titulo: "Análise", icone: ICONES.analise, vista: analise },
  { id: "previsao", titulo: "Previsão", icone: ICONES.previsao, vista: previsao },
  { id: "recorrencias", titulo: "Recorrentes", icone: ICONES.recorrencias, vista: recorrencias },
  { id: "config", titulo: "Configurar", icone: ICONES.config, vista: config },
]

const raiz = document.getElementById("app")

// ------------------------------------------------------------------ service worker (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}))
}

// ------------------------------------------------------------------ arranque
async function arrancar() {
  if (!navigator.onLine) document.body.classList.add("offline")
  try {
    const estado = await fetch("/api/orc/estado").then((r) => r.json())
    if (estado.precisa_configuracao) return ecraConfiguracaoInicial()
  } catch (_) { /* sem rede: segue com a sessão guardada */ }

  if (!pb.authStore.isValid) return ecraEntrada()
  if (bloqueioAtivo()) return ecraBloqueio()
  try {
    if (navigator.onLine) await pb.collection("users").authRefresh()
  } catch (err) {
    if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
      pb.authStore.clear()
      return ecraEntrada()
    }
  }
  await abrirApp()
}

async function abrirApp() {
  raiz.innerHTML = '<div class="arranque">A carregar dados…</div>'
  try {
    await iniciarDados()
  } catch (err) {
    raiz.innerHTML = ""
    raiz.append(h("div", { class: "arranque" }, `Não foi possível carregar os dados: ${erroTexto(err)}`))
    return
  }
  montarEstrutura()
  window.addEventListener("hashchange", desenhar)
  window.addEventListener("orc:dados", agendarDesenho)
  window.addEventListener("orc:modal-fechado", () => { if (pendente) desenhar() })
  desenhar()
}

// ------------------------------------------------------------------ ecrãs de entrada
function cartaoEntrada(titulo, texto, campos, botao, aoSubmeter, extra = null) {
  const erro = h("p", { class: "erro", role: "alert" })
  const form = h("form", {
    class: "entrada-form",
    onsubmit: async (e) => {
      e.preventDefault()
      erro.textContent = ""
      const b = form.querySelector("button")
      b.disabled = true
      try { await aoSubmeter(new FormData(form)) } catch (err) { erro.textContent = erroTexto(err) } finally { b.disabled = false }
    },
  }, campos, erro, h("button", { class: "btn btn-primario btn-bloco", type: "submit" }, botao))
  raiz.innerHTML = ""
  raiz.append(h("main", { class: "entrada" },
    h("div", { class: "entrada-cartao" },
      h("div", { class: "entrada-logo", html: '<img src="/icons/icon.svg" alt="" width="56" height="56">' }),
      h("h1", {}, titulo), texto ? h("p", { class: "sub" }, texto) : null, extra, form)))
}

// Botão "Entrar com impressão digital" (WebAuthn). aoEntrar corre depois de validado.
function botaoPasskey(texto, aoEntrar, opcoes = {}) {
  const erro = h("p", { class: "erro", role: "alert" })
  const btn = h("button", {
    type: "button", class: "btn btn-primario btn-bloco btn-digital",
    onclick: async () => {
      erro.textContent = ""
      btn.disabled = true
      try { await entrarComPasskey(opcoes); await aoEntrar() }
      catch (err) { erro.textContent = textoErroPasskey(err); btn.disabled = false }
    },
  }, h("span", { html: ICONES.digital }), texto)
  return { btn, erro }
}

const campo = (rotulo, input) => h("label", { class: "campo" }, h("span", {}, rotulo), input)

function ecraEntrada() {
  let extra = null
  if (passkeyDisponivel()) {
    const { btn, erro } = botaoPasskey("Entrar com impressão digital", abrirApp)
    extra = h("div", { class: "entrada-digital" }, btn, erro, h("div", { class: "separador-ou" }, h("span", {}, "ou com email")))
  }
  cartaoEntrada("Orçamento", passkeyDisponivel() ? null : "Entre com a sua conta.", [
    campo("Email", h("input", { name: "email", type: "email", required: true, autocomplete: "username" })),
    campo("Palavra-passe", h("input", { name: "password", type: "password", required: true, autocomplete: "current-password" })),
  ], "Entrar", async (fd) => {
    await pb.collection("users").authWithPassword(fd.get("email"), fd.get("password"))
    await abrirApp()
    proporAtivacao()
  }, extra)
}

// Com "Pedir a impressão digital ao abrir" ativo, a app fica bloqueada até confirmar.
function ecraBloqueio() {
  const { btn, erro } = botaoPasskey("Desbloquear com impressão digital", async () => {
    try { if (navigator.onLine) await pb.collection("users").authRefresh() } catch (_) {}
    await abrirApp()
  }, { semRedeLocal: true })
  raiz.innerHTML = ""
  raiz.append(h("main", { class: "entrada" },
    h("div", { class: "entrada-cartao" },
      h("div", { class: "entrada-logo", html: '<img src="/icons/icon.svg" alt="" width="56" height="56">' }),
      h("h1", {}, "Orçamento"),
      h("p", { class: "sub" }, `Olá ${pb.authStore.record?.name || ""}. Confirme a sua identidade para continuar.`),
      h("div", { class: "entrada-digital" }, btn, erro),
      h("button", { type: "button", class: "btn-texto", onclick: () => { pb.authStore.clear(); ecraEntrada() } }, "Entrar com outra conta"))))
  setTimeout(() => btn.focus(), 50)
}

function ecraConfiguracaoInicial() {
  cartaoEntrada("Bem-vindo", "Crie a conta de administrador. Depois pode convidar outros utilizadores em Configurar → Utilizadores.", [
    campo("Nome", h("input", { name: "nome", required: true, autocomplete: "name" })),
    campo("Email", h("input", { name: "email", type: "email", required: true, autocomplete: "username" })),
    campo("Palavra-passe (mín. 8 caracteres)", h("input", { name: "password", type: "password", minlength: 8, required: true, autocomplete: "new-password" })),
  ], "Criar administrador", async (fd) => {
    const r = await fetch("/api/orc/configurar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd)),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.message || "Erro")
    await pb.collection("users").authWithPassword(fd.get("email"), fd.get("password"))
    aviso("Administrador criado.", "ok")
    await abrirApp()
    proporAtivacao()
  })
}

export function sair() {
  pararSubscricoes()
  pb.authStore.clear()
  try { localStorage.removeItem("orc_cache") } catch (_) {}
  location.hash = ""
  location.reload()
}

// ------------------------------------------------------------------ estrutura
let conteudo, navLinks = []

function montarEstrutura() {
  raiz.innerHTML = ""
  const ambito = h("div", { class: "segmentado", role: "group", "aria-label": "Âmbito" },
    [["todos", "Tudo"], ["pessoal", "Pessoal"], ["profissional", "Profissional"]].map(([v, t]) =>
      h("button", {
        type: "button", "data-v": v, "aria-pressed": String(state.ambito === v),
        onclick: () => {
          setAmbito(v)
          ambito.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)))
        },
      }, t)))

  navLinks = ROTAS.map((r) => h("a", { href: `#${r.id}`, class: "nav-item", "data-rota": r.id },
    h("span", { class: "nav-icone", html: r.icone }), h("span", { class: "nav-texto" }, r.titulo)))

  const u = pb.authStore.record
  conteudo = h("main", { class: "conteudo", id: "conteudo" })
  raiz.append(
    h("header", { class: "topo" },
      h("div", { class: "topo-marca" },
        h("img", { src: "/icons/icon.svg", alt: "", width: 28, height: 28 }),
        h("strong", {}, def("nome_app", "Orçamento"))),
      ambito,
      h("div", { class: "topo-direita" },
        h("span", { class: "sem-rede", title: "Sem ligação: as alterações serão sincronizadas depois", html: ICONES.nuvem }),
        h("span", { class: "utilizador", title: u?.email }, u?.name || u?.email || ""),
        h("button", { class: "btn-icone", title: "Sair", "aria-label": "Sair", onclick: sair, html: ICONES.sair }))),
    h("nav", { class: "nav", "aria-label": "Navegação principal" }, navLinks),
    conteudo,
  )
}

let pendente = false, temporizador = null
function agendarDesenho() {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => { if (haModalAberto()) pendente = true; else desenhar() }, 120)
}

function desenhar() {
  pendente = false
  const id = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "painel"
  const rota = ROTAS.find((r) => r.id === id) || ROTAS[0]
  navLinks.forEach((a) => a.classList.toggle("ativo", a.dataset.rota === rota.id))
  document.title = `${rota.titulo} · ${def("nome_app", "Orçamento")}`
  const scroll = window.scrollY
  destruirGraficos()
  conteudo.innerHTML = ""
  try {
    rota.vista.render(conteudo)
  } catch (err) {
    console.error(err)
    conteudo.append(h("p", { class: "erro" }, `Erro ao mostrar esta página: ${err.message}`))
  }
  if (rota.id === estadoUltimaRota) window.scrollTo(0, scroll)
  estadoUltimaRota = rota.id
}
let estadoUltimaRota = null

window.addEventListener("focus", () => enviarPendentes())
export { isAdmin }

arrancar()
