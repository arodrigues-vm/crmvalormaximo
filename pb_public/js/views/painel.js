// Painel: resumo do mês, despesas por categoria, orçamento vs real e evolução.
import { state, h, eur, cor, mesAtual, somarMesesYM, nomeMes, MESES, movsFiltrados, ICONES, emitir } from "../core.js"
import { cartaoGrafico } from "../graficos.js"
import { calcularPrevisao, ym } from "../previsao-calc.js"
import { abrirFormMovimento } from "./form-movimento.js"
import { linhaMovimento } from "./movimentos.js"

let mes = mesAtual()

export function botaoNovo() {
  return h("button", { class: "fab", "aria-label": "Novo movimento", title: "Novo movimento",
    onclick: () => abrirFormMovimento(), html: ICONES.mais })
}

export function navegadorMes(valor, aoMudar) {
  return h("div", { class: "nav-mes" },
    h("button", { class: "btn-icone", "aria-label": "Mês anterior", onclick: () => aoMudar(somarMesesYM(valor, -1)), html: ICONES.esq }),
    h("label", { class: "nav-mes-rotulo" },
      h("span", {}, nomeMes(valor)),
      h("input", { type: "month", value: valor, "aria-label": "Escolher mês", onchange: (e) => e.target.value && aoMudar(e.target.value) })),
    h("button", { class: "btn-icone", "aria-label": "Mês seguinte", onclick: () => aoMudar(somarMesesYM(valor, 1)), html: ICONES.dir }))
}

function tile(rotulo, valor, detalhe, classe = "") {
  return h("div", { class: `tile ${classe}` },
    h("span", { class: "tile-rotulo" }, rotulo),
    h("strong", { class: "tile-valor" }, valor),
    detalhe ? h("span", { class: "tile-det" }, detalhe) : null)
}

export function render(el) {
  const movs = movsFiltrados()
  const doMes = movs.filter((m) => ym(m) === mes)
  const soma = (lista) => lista.reduce((s, m) => s + (Number(m.valor) || 0), 0)
  const rec = soma(doMes.filter((m) => m.tipo === "entrada"))
  const desp = soma(doMes.filter((m) => m.tipo === "saida"))
  const porPagar = doMes.filter((m) => !m.pago && m.tipo === "saida")

  // previsão do mês (só faz sentido para o mês atual ou futuros)
  let previstoDesp = null
  if (mes >= mesAtual()) {
    const p = calcularPrevisao([mes])
    previstoDesp = state.cats.filter((c) => c.tipo === "saida").reduce((s, c) => s + (p.porCategoria[c.id]?.meses[mes]?.valor || 0), 0)
  }

  const saldo = rec - desp
  el.append(
    h("div", { class: "pagina-topo" }, h("h1", {}, "Painel"), navegadorMes(mes, (v) => { mes = v; emitir() })),
    h("div", { class: "tiles" },
      tile("Receitas", eur(rec)),
      tile("Despesas", eur(desp), previstoDesp !== null ? `Previsão do mês: ${eur(previstoDesp)}` : null),
      tile("Saldo", eur(saldo), null, saldo < 0 ? "negativo" : "positivo"),
      tile("Por pagar", eur(soma(porPagar)), `${porPagar.length} movimento(s)`)),
  )

  // ---- despesas por categoria (mês)
  const porCat = {}
  for (const m of doMes) if (m.tipo === "saida") porCat[m.categoria] = (porCat[m.categoria] || 0) + Number(m.valor)
  const ordenadas = Object.entries(porCat).sort((a, b) => b[1] - a[1])
  const nomeCat = (id) => state.cats.find((c) => c.id === id)?.nome || "(sem categoria)"

  const grelha = h("div", { class: "grelha-cartoes" })
  grelha.append(cartaoGrafico({
    titulo: "Despesas por categoria", subtitulo: nomeMes(mes),
    labels: ordenadas.map(([id]) => nomeCat(id)),
    datasets: [{ label: "Despesas", data: ordenadas.map(([, v]) => v), backgroundColor: cor("serie-despesa") }],
    horizontal: true, altura: Math.max(160, ordenadas.length * 30 + 40),
  }))

  // ---- orçamento vs real
  const comOrc = state.cats.filter((c) => c.tipo === "saida" && Number(c.orcamento_mensal) > 0 && c.ativo)
  grelha.append(h("section", { class: "cartao" },
    h("header", { class: "cartao-topo" }, h("div", {}, h("h3", {}, "Orçamento vs real"), h("p", { class: "sub" }, nomeMes(mes)))),
    comOrc.length
      ? h("ul", { class: "orcamentos" }, comOrc.map((c) => {
        const real = porCat[c.id] || 0
        const orc = Number(c.orcamento_mensal)
        const pct = real / orc
        const estado = pct > 1 ? "critico" : pct > 0.85 ? "alerta" : "bom"
        return h("li", {},
          h("div", { class: "orc-linha" }, h("span", {}, c.nome),
            h("span", { class: "orc-valores" }, `${eur(real)} de ${eur(orc)}`,
              pct > 1 ? h("span", { class: "estado estado-critico" }, "▲ Excedido") : null)),
          h("div", { class: "medidor", role: "meter", "aria-valuemin": 0, "aria-valuemax": orc, "aria-valuenow": real, "aria-label": c.nome },
            h("span", { class: `medidor-barra ${estado}`, style: `width:${Math.min(100, pct * 100).toFixed(1)}%` })))
      }))
      : h("p", { class: "vazio" }, "Defina orçamentos mensais em Configurar → Categorias para acompanhar aqui.")))

  // ---- últimos 12 meses
  const meses12 = Array.from({ length: 12 }, (_, i) => somarMesesYM(mes, i - 11))
  const rotulos = meses12.map((k) => `${MESES[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`)
  const somaMes = (filtro) => meses12.map((k) => soma(movs.filter((m) => ym(m) === k && filtro(m))))
  const natureza = (m) => state.cats.find((c) => c.id === m.categoria)?.natureza

  grelha.append(cartaoGrafico({
    titulo: "Receitas e despesas", subtitulo: "Últimos 12 meses", labels: rotulos,
    datasets: [
      { label: "Receitas", data: somaMes((m) => m.tipo === "entrada"), backgroundColor: cor("serie-receita") },
      { label: "Despesas", data: somaMes((m) => m.tipo === "saida"), backgroundColor: cor("serie-despesa") },
    ],
  }))
  grelha.append(cartaoGrafico({
    titulo: "Despesas fixas e variáveis", subtitulo: "Últimos 12 meses", labels: rotulos, empilhado: true,
    datasets: [
      { label: "Fixas", data: somaMes((m) => m.tipo === "saida" && natureza(m) === "fixa"), backgroundColor: cor("serie-fixa") },
      { label: "Variáveis", data: somaMes((m) => m.tipo === "saida" && natureza(m) !== "fixa"), backgroundColor: cor("serie-variavel") },
    ],
  }))
  el.append(grelha)

  // ---- últimos movimentos
  const ultimos = movs.slice(0, 8)
  el.append(h("section", { class: "cartao" },
    h("header", { class: "cartao-topo" }, h("h3", {}, "Últimos movimentos"), h("a", { href: "#movimentos", class: "btn-texto" }, "Ver todos")),
    ultimos.length ? h("ul", { class: "lista-mov" }, ultimos.map(linhaMovimento))
      : h("p", { class: "vazio" }, "Ainda não há movimentos. Use o botão + para registar o primeiro.")))
  el.append(botaoNovo())
}
