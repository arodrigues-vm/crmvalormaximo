// Gráficos (Chart.js) com alternância para tabela, tooltip e cores do tema claro/escuro.
import { h, cor, eur, eur0 } from "./core.js"

const ativos = new Set()
export function destruirGraficos() {
  for (const g of ativos) g.destroy()
  ativos.clear()
}

function base() {
  const Chart = window.Chart
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  Chart.defaults.font.size = 12
  Chart.defaults.color = cor("texto-2")
  Chart.defaults.borderColor = cor("grelha")
}

// Série "real + previsto": o previsto usa a mesma cor, mais clara e com contorno tracejado.
export function serieComPrevisao(rotuloSerie, real, previsto, corSerie, stack) {
  return [
    { label: rotuloSerie, data: real, backgroundColor: corSerie, stack, _previsto: false },
    {
      label: `${rotuloSerie} (previsto)`, data: previsto, backgroundColor: corSerie + "40",
      borderColor: corSerie, borderWidth: 1.5, borderDash: [4, 3], stack, _previsto: true,
    },
  ]
}

/**
 * Cartão com gráfico de barras.
 * opcoes: { titulo, subtitulo, labels, datasets, horizontal, empilhado, altura, legenda }
 */
export function cartaoGrafico(opcoes) {
  const { titulo, subtitulo, labels, datasets, horizontal = false, empilhado = false, altura = 260 } = opcoes
  const canvas = h("canvas", { role: "img", "aria-label": titulo })
  const zonaGrafico = h("div", { class: "grafico", style: `height:${altura}px` }, canvas)
  const zonaTabela = h("div", { class: "grafico-tabela", hidden: true }, tabelaDe(labels, datasets))
  const btn = h("button", {
    class: "btn-texto", type: "button", "aria-pressed": "false",
    onclick: () => {
      const tabela = zonaTabela.hidden
      zonaTabela.hidden = !tabela
      zonaGrafico.hidden = tabela
      btn.textContent = tabela ? "Gráfico" : "Tabela"
      btn.setAttribute("aria-pressed", String(tabela))
    },
  }, "Tabela")

  const vazio = !datasets.some((d) => d.data.some((v) => v))
  const cartao = h("section", { class: "cartao" },
    h("header", { class: "cartao-topo" },
      h("div", {}, h("h3", {}, titulo), subtitulo ? h("p", { class: "sub" }, subtitulo) : null),
      vazio ? null : btn),
    vazio ? h("p", { class: "vazio" }, "Sem dados para este período.") : [zonaGrafico, zonaTabela])
  if (vazio) return cartao

  requestAnimationFrame(() => {
    base()
    const mostrarLegenda = opcoes.legenda ?? datasets.filter((d) => !d._previsto).length > 1
    const eixoValor = {
      beginAtZero: true, stacked: empilhado,
      grid: { color: cor("grelha"), drawTicks: false },
      border: { display: false },
      ticks: { padding: 6, callback: (v) => eur0(v), maxTicksLimit: 6 },
    }
    const eixoCat = {
      stacked: empilhado, grid: { display: false },
      border: { color: cor("eixo") },
      ticks: { autoSkip: !horizontal, maxRotation: 0 },
    }
    const g = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: datasets.map((d) => ({
          borderRadius: 4, borderSkipped: "start",
          categoryPercentage: 0.72, barPercentage: 0.88, maxBarThickness: 28,
          ...d,
        })),
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        scales: horizontal ? { x: eixoValor, y: eixoCat } : { x: eixoCat, y: eixoValor },
        plugins: {
          legend: {
            display: mostrarLegenda, position: "top", align: "start",
            labels: {
              boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2, padding: 14,
              color: cor("texto-1"),
              filter: (item, data) => !data.datasets[item.datasetIndex]._previsto || opcoes.legendaPrevisto,
            },
          },
          tooltip: {
            backgroundColor: cor("superficie"), titleColor: cor("texto-1"), bodyColor: cor("texto-1"),
            borderColor: cor("borda"), borderWidth: 1, padding: 10, boxPadding: 4,
            filter: (item) => item.raw !== 0,
            callbacks: { label: (c) => ` ${c.dataset.label}: ${eur(c.raw)}` },
          },
        },
      },
    })
    ativos.add(g)
  })
  return cartao
}

function tabelaDe(labels, datasets) {
  return h("div", { class: "tabela-scroll" },
    h("table", { class: "tabela" },
      h("thead", {}, h("tr", {}, h("th", {}, ""), datasets.map((d) => h("th", { class: "num" }, d.label)))),
      h("tbody", {}, labels.map((l, i) => h("tr", {},
        h("th", { scope: "row" }, l),
        datasets.map((d) => h("td", { class: "num" }, eur(d.data[i]))))))))
}
