// Service worker: guarda a aplicação no aparelho para abrir sem rede.
// Os dados (/api) nunca são guardados aqui: a app usa a sua própria cache e fila de envio.
const VERSAO = "orc-v12"
const ESSENCIAIS = [
  "/", "/index.html", "/css/app.css", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png",
  "/vendor/pocketbase.es.mjs", "/vendor/chart.umd.min.js",
  "/js/app.js", "/js/core.js", "/js/passkey.js", "/js/graficos.js", "/js/previsao-calc.js",
  "/js/views/inicio.js", "/js/views/painel.js", "/js/views/movimentos.js", "/js/views/analise.js", "/js/views/previsao.js",
  "/js/views/recorrencias.js", "/js/views/config.js", "/js/views/form-movimento.js",
]

self.addEventListener("install", (e) => {
  // cache: "reload" garante que a instalação descarrega sempre a versão nova do servidor
  e.waitUntil(caches.open(VERSAO)
    .then((c) => c.addAll(ESSENCIAIS.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()))
})

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

// Rede primeiro (para receber sempre a versão mais recente); se falhar, usa a cópia guardada.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_/")) return
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)) }
        return r
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((r) => r || (e.request.mode === "navigate" ? caches.match("/index.html") : undefined))),
  )
})
