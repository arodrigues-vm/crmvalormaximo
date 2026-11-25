// Página de abertura: por privacidade não mostra nenhum valor nem registo.
import { pb, h, ICONES, lerLocal } from "../core.js"
import { abrirFormMovimento } from "./form-movimento.js"

const ATALHOS = [
  ["painel", "Painel", "Resumo do mês e orçamento", ICONES.painel],
  ["movimentos", "Movimentos", "Lista, filtros e pesquisa", ICONES.movimentos],
  ["analise", "Análise", "Mapa anual por categoria", ICONES.analise],
  ["previsao", "Previsão", "Gastos previstos do mês e do ano", ICONES.previsao],
  ["recorrencias", "Recorrentes", "Despesas e receitas que se repetem", ICONES.recorrencias],
  ["config", "Configurar", "Categorias, utilizadores e perfil", ICONES.config],
]

// Preferência deste aparelho: "inicio" (por omissão) ou "ultima" (voltar à última página).
export const paginaAbertura = () => lerLocal("orc_abertura", "inicio")

export function render(el) {
  const nome = (pb.authStore.record?.name || "").trim()   // nome definido em O meu perfil
  const hoje = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())

  el.append(
    h("section", { class: "inicio-boasvindas" },
      h("p", { class: "inicio-data" }, hoje.charAt(0).toUpperCase() + hoje.slice(1)),
      h("h1", {}, nome ? `Olá, ${nome}` : "Olá")),
    h("div", { class: "inicio-acoes" },
      h("button", { type: "button", class: "inicio-acao despesa", onclick: () => abrirFormMovimento(null, { tipo: "saida" }) },
        h("span", { class: "inicio-acao-icone", html: ICONES.mais }),
        h("span", {}, h("strong", {}, "Registar despesa"), h("small", {}, "Compra, fatura, pagamento"))),
      h("button", { type: "button", class: "inicio-acao receita", onclick: () => abrirFormMovimento(null, { tipo: "entrada" }) },
        h("span", { class: "inicio-acao-icone", html: ICONES.mais }),
        h("span", {}, h("strong", {}, "Registar receita"), h("small", {}, "Salário, honorários, reembolso")))),
    h("nav", { class: "inicio-atalhos", "aria-label": "Módulos" },
      ATALHOS.map(([id, titulo, desc, icone]) => h("a", { href: `#${id}`, class: "inicio-atalho" },
        h("span", { class: "inicio-atalho-icone", html: icone }),
        h("span", {}, h("strong", {}, titulo), h("small", {}, desc))))),
  )
}
