// Previsão de despesas e receitas: mensal (próximos meses) e anual (real + previsto).
import { state, h, eur, eur0, cor, MESES, mesAtual, somarMesesYM, nomeMes, emitir, lerLocal, gravarLocal, rotulo } from "../core.js"
import { cartaoGrafico, serieComPrevisao } from "../graficos.js"
import { calcularPrevisao, mesesDoAno, totaisTipo } from "../previsao-calc.js"

const opc = Object.assign({ horizonte: "ano" }, lerLocal("orc_previsao", {}))

export function render(el) {
  const atual = mesAtual()
  const ano = Number(atual.slice(0, 4))
  const meses = opc.horizonte === "ano"
    ? mesesDoAno(ano)
    : Array.from({ length: 12 }, (_, i) => somarMesesYM(atual, i))
  const prev = calcularPrevisao(meses)
  const proximo = somarMesesYM(atual, 1)
  const prevProx = opc.horizonte === "ano" && !meses.includes(proximo) ? calcularPrevisao([proximo]) : prev

  const desp = totaisTipo(prev, meses, "saida")
  const rec = totaisTipo(prev, meses, "entrada")
  const soma = (arr, k) => arr.reduce((s, v) => s + v[k], 0)
  const totalDesp = soma(desp, "valor"), totalRec = soma(rec, "valor")
  const despProx = state.cats.filter((c) => c.tipo === "saida")
    .reduce((s, c) => s + (prevProx.porCategoria[c.id]?.meses[proximo]?.valor || 0), 0)
  const despAtual = state.cats.filter((c) => c.tipo === "saida")
    .reduce((s, c) => s + (prev.porCategoria[c.id]?.meses[atual]?.valor || 0), 0)

  const periodo = opc.horizonte === "ano" ? `Ano ${ano}` : `${nomeMes(meses[0])} a ${nomeMes(meses[11])}`
  el.append(
    h("div", { class: "pagina-topo" }, h("h1", {}, "Previsão"),
      h("div", { class: "segmentado", role: "group", "aria-label": "Horizonte" },
        [["ano", `Ano ${ano}`], ["12m", "Próximos 12 meses"]].map(([v, t]) => h("button", {
          type: "button", "aria-pressed": String(opc.horizonte === v),
          onclick: () => { opc.horizonte = v; gravarLocal("orc_previsao", opc); emitir() },
        }, t)))),
    h("div", { class: "tiles" },
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, `Despesas · ${periodo}`), h("strong", { class: "tile-valor" }, eur(totalDesp)),
        h("span", { class: "tile-det" }, `${eur(soma(desp, "real"))} registado + ${eur(soma(desp, "previsto"))} previsto`)),
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, `Receitas · ${periodo}`), h("strong", { class: "tile-valor" }, eur(totalRec)),
        h("span", { class: "tile-det" }, `${eur(soma(rec, "real"))} registado + ${eur(soma(rec, "previsto"))} previsto`)),
      h("div", { class: `tile ${totalRec - totalDesp < 0 ? "negativo" : "positivo"}` }, h("span", { class: "tile-rotulo" }, "Saldo previsto"),
        h("strong", { class: "tile-valor" }, eur(totalRec - totalDesp))),
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, "Despesas previstas"),
        h("strong", { class: "tile-valor" }, eur(despProx)),
        h("span", { class: "tile-det" }, `${nomeMes(proximo)} · este mês: ${eur(despAtual)}`))),
  )

  const rotulos = meses.map((k) => `${MESES[Number(k.slice(5)) - 1]}${opc.horizonte === "ano" ? "" : " " + k.slice(2, 4)}`)
  el.append(cartaoGrafico({
    titulo: "Receitas e despesas: registado e previsto", subtitulo: `${periodo} · a parte tracejada é previsão`,
    labels: rotulos, empilhado: true, legendaPrevisto: true, altura: 300,
    datasets: [
      ...serieComPrevisao("Receitas", rec.map((v) => v.real), rec.map((v) => v.previsto), cor("serie-receita"), "r"),
      ...serieComPrevisao("Despesas", desp.map((v) => v.real), desp.map((v) => v.previsto), cor("serie-despesa"), "d"),
    ],
  }))

  // tabela por categoria
  const futuros = meses.filter((k) => k >= atual)
  const linhaCat = (c) => {
    const p = prev.porCategoria[c.id]
    const total = meses.reduce((s, k) => s + (p?.meses[k]?.valor || 0), 0)
    const prox = (prevProx.porCategoria[c.id]?.meses[proximo]) || { valor: 0, fonte: "—" }
    const orc = Number(c.orcamento_mensal) || 0
    return { c, media: p?.media || 0, prox, total, orcPeriodo: orc * meses.length }
  }
  const blocos = []
  for (const tipo of ["saida", "entrada"]) {
    for (const nat of ["fixa", "variavel"]) {
      const linhas = state.cats.filter((c) => c.tipo === tipo && (c.natureza || "variavel") === nat)
        .map(linhaCat).filter((l) => l.total || l.media || l.prox.valor || l.c.ativo)
        .sort((a, b) => b.total - a.total)
      if (linhas.length) blocos.push({ tipo, nat, linhas })
    }
  }
  const sub = (ls, k) => ls.reduce((s, l) => s + (k === "prox" ? l.prox.valor : l[k]), 0)

  el.append(h("section", { class: "cartao" },
    h("header", { class: "cartao-topo" }, h("div", {}, h("h3", {}, "Previsão por categoria"),
      h("p", { class: "sub" }, `${periodo} · média dos últimos ${prev.mesesMedia || 0} de ${prev.nMedia} meses`))),
    h("div", { class: "tabela-scroll" }, h("table", { class: "tabela" },
      h("thead", {}, h("tr", {},
        h("th", {}, "Categoria"), h("th", { class: "num" }, "Média mensal"),
        h("th", { class: "num" }, nomeMes(proximo)), h("th", {}, "Base de cálculo"),
        h("th", { class: "num destaque" }, opc.horizonte === "ano" ? `Total ${ano}` : "Total 12 meses"),
        h("th", { class: "num" }, "Orçamento"))),
      blocos.map((b) => h("tbody", {},
        h("tr", { class: "linha-grupo" }, h("th", { colspan: 6 },
          `${b.tipo === "saida" ? "Despesas" : "Receitas"} ${b.nat === "fixa" ? "fixas" : "variáveis"}`)),
        b.linhas.map((l) => h("tr", {},
          h("th", { scope: "row" }, l.c.nome),
          h("td", { class: "num" }, eur0(l.media)),
          h("td", { class: "num" }, eur0(l.prox.valor)),
          h("td", { class: "fonte" }, l.prox.fonte),
          h("td", { class: "num destaque" }, eur0(l.total)),
          h("td", { class: "num" }, l.orcPeriodo ? eur0(l.orcPeriodo) : "–"))),
        h("tr", { class: "linha-subtotal" },
          h("th", {}, "Subtotal"), h("td", { class: "num" }, eur0(sub(b.linhas, "media"))),
          h("td", { class: "num" }, eur0(sub(b.linhas, "prox"))), h("td", {}),
          h("td", { class: "num destaque" }, eur0(sub(b.linhas, "total"))),
          h("td", { class: "num" }, eur0(sub(b.linhas, "orcPeriodo")) ))))))))

  el.append(h("section", { class: "cartao nota" },
    h("h3", {}, "Como é calculada a previsão"),
    h("ul", {},
      h("li", {}, h("strong", {}, "Despesas fixas com movimento recorrente: "), "usa o valor e a periodicidade das recorrências (um seguro anual só conta no mês em que vence)."),
      h("li", {}, h("strong", {}, "Fixas sem recorrência e variáveis: "), `média dos últimos ${prev.nMedia} meses completos (configurável em Configurar → Definições → meses_media).`),
      h("li", {}, h("strong", {}, "Sem histórico: "), "usa o orçamento mensal da categoria, se estiver definido."),
      h("li", {}, h("strong", {}, "Mês corrente: "), "o maior entre o já registado e o previsto."),
      futuros.length < meses.length ? h("li", {}, "Os meses já terminados mostram apenas valores registados.") : null)))
}
