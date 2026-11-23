// Impressão digital / Face ID / Windows Hello (WebAuthn "passkeys").
import { pb, h, aviso, erroTexto, abrirModal, fecharModal, confirmar, lerLocal, gravarLocal, dataCurta, dataISO } from "./core.js"

// ------------------------------------------------------------------ conversões base64url <-> bytes
const paraBytes = (b64) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "="))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}
const paraB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

export function passkeyDisponivel() {
  return !!(window.PublicKeyCredential && window.isSecureContext && navigator.credentials)
}

// Aparelho onde a impressão digital foi ativada (guardado só neste aparelho).
export const passkeyNesteAparelho = () => lerLocal("orc_passkey_id", null)
export const bloqueioAtivo = () => !!lerLocal("orc_bloqueio", false) && !!passkeyNesteAparelho()
export const definirBloqueio = (v) => gravarLocal("orc_bloqueio", !!v)

export function nomeAparelho() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return "iPhone"
  if (/iPad/.test(ua)) return "iPad"
  if (/Android/.test(ua)) return "Android"
  if (/Windows/.test(ua)) return "Computador Windows"
  if (/Mac OS X/.test(ua)) return "Mac"
  return "Este aparelho"
}

function mensagemErro(err) {
  if (err?.name === "NotAllowedError") return "Operação cancelada ou o tempo terminou."
  if (err?.name === "InvalidStateError") return "Este aparelho já está ativado."
  if (err?.name === "NotSupportedError") return "Este aparelho ou browser não suporta impressão digital."
  return erroTexto(err)
}

// ------------------------------------------------------------------ registar este aparelho
export async function ativarNesteAparelho(nome = nomeAparelho()) {
  const opcoes = await pb.send("/api/orc/passkey/registo/inicio", { method: "POST" })
  const pk = opcoes.publicKey
  pk.challenge = paraBytes(pk.challenge)
  pk.user.id = paraBytes(pk.user.id)
  pk.excludeCredentials = (pk.excludeCredentials || []).map((c) => ({ ...c, id: paraBytes(c.id) }))

  const cred = await navigator.credentials.create({ publicKey: pk })
  const corpo = {
    id: cred.id, rawId: paraB64(cred.rawId), type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    response: {
      attestationObject: paraB64(cred.response.attestationObject),
      clientDataJSON: paraB64(cred.response.clientDataJSON),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  }
  const r = await pb.send("/api/orc/passkey/registo/fim", { method: "POST", query: { nome }, body: corpo })
  gravarLocal("orc_passkey_id", r.credencial_id)
  return r
}

// ------------------------------------------------------------------ entrar com impressão digital
// Valida no servidor e devolve uma sessão nova. Sem rede, aceita a verificação local no aparelho
// (só serve para desbloquear uma sessão que já existia).
export async function entrarComPasskey({ semRedeLocal = false } = {}) {
  if (semRedeLocal && !navigator.onLine) {
    const id = passkeyNesteAparelho()
    await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), userVerification: "required",
      allowCredentials: id ? [{ type: "public-key", id: paraBytes(id) }] : [],
    } })
    return true
  }
  const { sessao, opcoes } = await pb.send("/api/orc/passkey/entrar/inicio", { method: "POST" })
  const pk = opcoes.publicKey
  pk.challenge = paraBytes(pk.challenge)
  pk.allowCredentials = (pk.allowCredentials || []).map((c) => ({ ...c, id: paraBytes(c.id) }))
  const cred = await navigator.credentials.get({ publicKey: pk })
  const corpo = {
    id: cred.id, rawId: paraB64(cred.rawId), type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    response: {
      authenticatorData: paraB64(cred.response.authenticatorData),
      clientDataJSON: paraB64(cred.response.clientDataJSON),
      signature: paraB64(cred.response.signature),
      userHandle: cred.response.userHandle ? paraB64(cred.response.userHandle) : undefined,
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  }
  const r = await pb.send("/api/orc/passkey/entrar/fim", { method: "POST", query: { sessao }, body: corpo })
  pb.authStore.save(r.token, r.record)
  gravarLocal("orc_passkey_id", cred.id)
  return true
}

export function textoErroPasskey(err) { return mensagemErro(err) }

// ------------------------------------------------------------------ convite após entrar com palavra-passe
export function proporAtivacao() {
  if (!passkeyDisponivel() || passkeyNesteAparelho() || lerLocal("orc_passkey_perguntado", false)) return
  gravarLocal("orc_passkey_perguntado", true)
  const erro = h("p", { class: "erro", role: "alert" })
  abrirModal("Entrar com impressão digital", h("div", { class: "form" },
    h("p", {}, "Quer usar a impressão digital (ou Face ID / Windows Hello) para entrar neste aparelho, sem escrever a palavra-passe?"),
    h("p", { class: "sub" }, "A impressão digital fica só no aparelho; o servidor guarda apenas uma chave de verificação."),
    erro,
    h("div", { class: "acoes" },
      h("button", { class: "btn", onclick: fecharModal }, "Agora não"),
      h("span", { class: "espaco" }),
      h("button", {
        class: "btn btn-primario",
        onclick: async (e) => {
          e.target.disabled = true
          try { await ativarNesteAparelho(); fecharModal(); aviso("Impressão digital ativada neste aparelho.", "ok") }
          catch (err) { erro.textContent = mensagemErro(err); e.target.disabled = false }
        },
      }, "Ativar"))))
}

// ------------------------------------------------------------------ secção no perfil
export function seccaoPasskeys() {
  const zona = h("section", { class: "cartao" })
  const desenhar = async () => {
    zona.innerHTML = ""
    zona.append(h("header", { class: "cartao-topo" }, h("div", {},
      h("h3", {}, "Impressão digital / Face ID"),
      h("p", { class: "sub" }, "Entre na app sem palavra-passe nos aparelhos que ativar."))))
    if (!passkeyDisponivel()) {
      zona.append(h("p", { class: "vazio" }, "Este browser não suporta impressão digital, ou a app não está a ser aberta em https."))
      return
    }
    let lista = []
    try { lista = await pb.collection("passkeys").getFullList({ sort: "-created" }) } catch (_) {}
    const atual = passkeyNesteAparelho()
    const esteAtivo = lista.some((p) => p.credencial_id === atual)
    if (atual && !esteAtivo && navigator.onLine) { gravarLocal("orc_passkey_id", null); definirBloqueio(false) }

    zona.append(lista.length
      ? h("ul", { class: "lista-aparelhos" }, lista.map((p) => h("li", {},
        h("div", {}, h("strong", {}, p.nome || "Aparelho"), p.credencial_id === atual ? h("span", { class: "etiqueta etiqueta-info" }, "Este aparelho") : null,
          h("div", { class: "sub" }, `Ativado em ${dataCurta(dataISO(p.created))}`, p.ultimo_uso ? ` · último uso ${dataCurta(dataISO(p.ultimo_uso))}` : "")),
        h("button", { class: "btn btn-perigo-texto", onclick: async () => {
          if (!(await confirmar(`Remover "${p.nome}"? Nesse aparelho volta a ser preciso o email e a palavra-passe.`))) return
          try {
            await pb.collection("passkeys").delete(p.id)
            if (p.credencial_id === atual) { gravarLocal("orc_passkey_id", null); definirBloqueio(false) }
            aviso("Aparelho removido.", "ok"); desenhar()
          } catch (err) { aviso(erroTexto(err), "erro") }
        } }, "Remover"))))
      : h("p", { class: "vazio" }, "Ainda não ativou nenhum aparelho."))

    const erro = h("p", { class: "erro", role: "alert" })
    if (!passkeyNesteAparelho()) {
      const inNome = h("input", { value: nomeAparelho(), maxlength: 80, "aria-label": "Nome deste aparelho" })
      zona.append(h("div", { class: "form form-estreito" },
        h("label", { class: "campo" }, h("span", {}, "Nome deste aparelho"), inNome),
        erro,
        h("div", { class: "acoes" }, h("button", { class: "btn btn-primario", onclick: async (e) => {
          e.target.disabled = true
          try { await ativarNesteAparelho(inNome.value.trim() || nomeAparelho()); aviso("Impressão digital ativada neste aparelho.", "ok"); desenhar() }
          catch (err) { erro.textContent = mensagemErro(err); e.target.disabled = false }
        } }, "Ativar neste aparelho"))))
    } else {
      zona.append(h("label", { class: "campo-check" },
        h("input", { type: "checkbox", checked: bloqueioAtivo(), onchange: (e) => {
          definirBloqueio(e.target.checked)
          aviso(e.target.checked ? "A app vai pedir a impressão digital sempre que abrir." : "Bloqueio ao abrir desativado.", "ok")
        } }),
        "Pedir a impressão digital sempre que abro a app neste aparelho"))
    }
  }
  desenhar()
  return zona
}
