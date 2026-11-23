// Análise: mapa anual (mês a mês) por categoria/grupo/fornecedor/responsável/método + comparação com anos anteriores.
import { state, h, eur, eur0, cor, MESES, movsFiltrados, nomeDe, dataISO, emitir, lerLocal, gravarLocal, rotulo } from "../core.js"
import { cartaoGrafico } from "../graficos.js"

const opc = Object.assign({ ano: new Date().getFullYear(), tipo: "saida", por: "categoria" }, lerLocal("orc_analise", {}))
const mudar = (k, conv = (v) => v) => (e) => { opc[k] = conv(e.target.value); gravarLocal("orc_analise", opc); emitir() }

const DIMENSOES = {
  categoria: { rotulo: "Categoria", chave: (m) => m.categoria, nome: (id) => nomeDe(state.cats, id) },
  grupo: { rotulo: "Grupo", chave: (m) => state.cats.find((c) => c.id === m.categoria)?.grupo || "Outras", nome: (g) => g },
  natureza: { rotulo: "Fixa / variável", chave: (m) => state.cats.find((c) => c.id === m.categoria)?.natureza || "variavel", nome: rotulo },
  fornecedor: { rotulo: "Fornecedor", chave: (m) => m.fornecedor, nome: (id) => nomeDe(state.forn, id) },
  responsavel: { rotulo: "Responsável", chave: (m) => m.responsavel, nome: (id) => nomeDe(state.resp, id) },
  metodo: { rotulo: "Método de pagamento", chave: (m) => m.metodo_pagamento, nome: (id) => nomeDe(state.metodos, id) },
  ambito: { rotulo: "Âmbito", chave: (m) => m.ambito, nome: rotulo },
}

export function render(el) {
  const dim = DIMENSOES[opc.por] || DIMENSOES.categoria
  const movs = movsFiltrados().filter((m) => m.tipo === opc.tipo)
  const ano = Number(opc.ano)

  // linhas[chave] = { meses: [12], ant1, ant2 }
  const linhas = {}
  for (const m of movs) {
    const d = dataISO(m.data)
    const y = Number(d.slice(0, 4))
    if (y < ano - 2 || y > ano) continue
    const k = dim.chave(m) || ""
    const l = (linhas[k] ||= { meses: Array(12).fill(0), total: 0, ant1: 0, ant2: 0 })
    const v = Number(m.valor) || 0
    if (y === ano) { l.meses[Number(d.slice(5, 7)) - 1] += v; l.total += v }
    else if (y === ano - 1) l.ant1 += v
    else l.ant2 += v
  }
  const ordem = Object.entries(linhas).sort((a, b) => b[1].total - a[1].total || b[1].ant1 - a[1].ant1)
  const tot = { meses: Array(12).fill(0), total: 0, ant1: 0, ant2: 0 }
  for (const [, l] of ordem) {
    l.meses.forEach((v, i) => (tot.meses[i] += v))
    tot.total += l.total; tot.ant1 += l.ant1; tot.ant2 += l.ant2
  }
  // último mês a considerar no ano (para a comparação homóloga): dezembro em anos passados, o mês atual no ano corrente
  const mesFim = (() => {
    const hoje = new Date()
    if (ano < hoje.getFullYear()) return 12
    if (ano > hoje.getFullYear()) return 0
    return hoje.getMonth() + 1
  })()
  // média mensal: conta só os meses desde o 1.º movimento registado (e não o ano inteiro)
  const primeiraData = movsFiltrados().reduce((min, m) => { const d = dataISO(m.data); return !min || d < min ? d : min }, "")
  const mesInicio = !primeiraData || Number(primeiraData.slice(0, 4)) > ano ? 13
    : Number(primeiraData.slice(0, 4)) < ano ? 1 : Number(primeiraData.slice(5, 7))
  const mesesComDados = Math.max(0, mesFim - mesInicio + 1)

  const anos = []
  for (let a = new Date().getFullYear() + 1; a >= new Date().getFullYear() - 2; a--) anos.push(a)
  const tipoTxt = opc.tipo === "saida" ? "Despesas" : "Receitas"

  el.append(
    h("div", { class: "pagina-topo" }, h("h1", {}, "Análise")),
    h("div", { class: "filtros" },
      h("select", { "aria-label": "Ano", onchange: mudar("ano", Number) }, anos.map((a) => h("option", { value: a, selected: a === ano }, a))),
      h("select", { "aria-label": "Tipo", onchange: mudar("tipo") },
        h("option", { value: "saida", selected: opc.tipo === "saida" }, "Despesas"),
        h("option", { value: "entrada", selected: opc.tipo === "entrada" }, "Receitas")),
      h("label", { class: "filtro-rotulo" }, "Agrupar por ",
        h("select", { onchange: mudar("por") }, Object.entries(DIMENSOES).map(([k, d]) =>
          h("option", { value: k, selected: k === opc.por }, d.rotulo))))),
    h("div", { class: "tiles" },
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, `${tipoTxt} ${ano}`), h("strong", { class: "tile-valor" }, eur(tot.total))),
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, "Média mensal"),
        h("strong", { class: "tile-valor" }, eur(mesesComDados ? tot.total / mesesComDados : 0)),
        h("span", { class: "tile-det" }, mesesComDados
          ? `${mesesComDados} ${mesesComDados === 1 ? "mês" : "meses"} com registos (${MESES[mesInicio - 1]}${mesesComDados > 1 ? `–${MESES[mesFim - 1]}` : ""})`
          : "sem registos")),
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, `${tipoTxt} ${ano - 1}`), h("strong", { class: "tile-valor" }, eur(tot.ant1))),
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, `${tipoTxt} ${ano - 2}`), h("strong", { class: "tile-valor" }, eur(tot.ant2)))),
  )

  // gráfico: este ano vs ano anterior, mês a mês
  const anteriorMes = Array(12).fill(0)
  for (const m of movs) {
    const d = dataISO(m.data)
    if (d.startsWith(String(ano - 1))) anteriorMes[Number(d.slice(5, 7)) - 1] += Number(m.valor) || 0
  }
  el.append(cartaoGrafico({
    titulo: `${tipoTxt} por mês`, subtitulo: `${ano} comparado com ${ano - 1}`, labels: MESES,
    datasets: [
      { label: String(ano), data: tot.meses, backgroundColor: cor(opc.tipo === "saida" ? "serie-despesa" : "serie-receita") },
      { label: String(ano - 1), data: anteriorMes, backgroundColor: cor("serie-neutra") },
    ],
  }))

  // mapa anual
  const pct = (a, b) => (b ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(0)}%` : "—")
  const celula = (v) => h("td", { class: `num ${v ? "" : "zero"}` }, v ? eur0(v) : "–")
  el.append(h("section", { class: "cartao" },
    h("header", { class: "cartao-topo" }, h("div", {}, h("h3", {}, `Mapa anual por ${dim.rotulo.toLowerCase()}`),
      h("p", { class: "sub" }, `${tipoTxt} ${ano} · variação face a ${ano - 1} no período homólogo`))),
    ordem.length ? h("div", { class: "tabela-scroll" },
      h("table", { class: "tabela mapa" },
        h("thead", {}, h("tr", {},
          h("th", { class: "fixa-col" }, dim.rotulo), MESES.map((m) => h("th", { class: "num" }, m)),
          h("th", { class: "num destaque" }, `Total ${ano}`), h("th", { class: "num" }, "Média"),
          h("th", { class: "num" }, String(ano - 1)), h("th", { class: "num" }, String(ano - 2)), h("th", { class: "num" }, "Var."))),
        h("tbody", {}, ordem.map(([k, l]) => {
          const homologo = homologoAnt(movs, ano, mesFim, (m) => (dim.chave(m) || "") === k)
          return h("tr", {},
            h("th", { scope: "row", class: "fixa-col" }, dim.nome(k) || "(não indicado)"),
            l.meses.map(celula),
            h("td", { class: "num destaque" }, eur0(l.total)),
            h("td", { class: "num" }, eur0(mesesComDados ? l.total / mesesComDados : 0)),
            celula(l.ant1), celula(l.ant2),
            h("td", { class: "num" }, pct(l.total, homologo)))
        })),
        h("tfoot", {}, h("tr", {},
          h("th", { class: "fixa-col" }, "Total"), tot.meses.map(celula),
          h("td", { class: "num destaque" }, eur0(tot.total)),
          h("td", { class: "num" }, eur0(mesesComDados ? tot.total / mesesComDados : 0)),
          celula(tot.ant1), celula(tot.ant2),
          h("td", { class: "num" }, pct(tot.total, homologoAnt(movs, ano, mesFim, () => true))))))) : h("p", { class: "vazio" }, "Sem movimentos neste ano."),
  ))
}

// Total do ano anterior nos mesmos meses (para uma comparação justa a meio do ano).
function homologoAnt(movs, ano, nMeses, filtro) {
  const lim = `${ano - 1}-${String(nMeses).padStart(2, "0")}-31`
  return movs.filter((m) => { const d = dataISO(m.data); return d.startsWith(String(ano - 1)) && d <= lim && filtro(m) })
    .reduce((s, m) => s + (Number(m.valor) || 0), 0)
}
