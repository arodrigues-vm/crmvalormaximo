// Cálculos de análise e previsão (feitos no próprio aparelho, sobre os dados já carregados).
//
// Método de previsão, por categoria e por mês futuro:
//   • Despesas/receitas FIXAS com recorrência registada → valor das recorrências que caem nesse mês
//     (respeita a periodicidade: um seguro anual só aparece no mês em que vence).
//   • FIXAS sem recorrência → média dos últimos N meses completos.
//   • VARIÁVEIS → média dos últimos N meses completos (+ recorrências, se existirem).
//   • Sem histórico → orçamento mensal da categoria, se estiver definido.
//   • Mês corrente → o maior entre o valor já registado e o valor previsto.
// N = definição "meses_media" (por omissão 6).
import { state, mesAtual, somarMesesYM, dataISO, def, movsFiltrados, recsFiltradas } from "./core.js"

const PASSO = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }

export const ym = (m) => dataISO(m.data).slice(0, 7)

// Somatório por categoria e mês: { catId: { "2026-03": 123.4 } }
export function totaisPorCategoriaMes(movs) {
  const t = {}
  for (const m of movs) {
    const c = (t[m.categoria] ||= {})
    const k = ym(m)
    c[k] = (c[k] || 0) + (Number(m.valor) || 0)
  }
  return t
}

// Valores das recorrências por categoria e mês, de "deMes" até "ateMes" (inclusive).
export function recorrenciasPorMes(recs, deMes, ateMes) {
  const t = {}
  for (const r of recs) {
    const passo = PASSO[r.periodicidade] || 1
    const fim = dataISO(r.data_fim).slice(0, 7)
    let k = dataISO(r.proxima_data).slice(0, 7)
    let guarda = 0
    while (k <= ateMes && (!fim || k <= fim) && guarda++ < 400) {
      if (k >= deMes) {
        const c = (t[r.categoria] ||= {})
        c[k] = (c[k] || 0) + (Number(r.valor) || 0)
      }
      k = somarMesesYM(k, passo)
    }
  }
  return t
}

// Calcula a previsão para os meses indicados (lista de "AAAA-MM").
// Devolve { porCategoria: {catId: {meses: {ym: {real, previsto, valor, fonte}}, media}}, mesesMedia }
export function calcularPrevisao(meses) {
  const movs = movsFiltrados()
  const atual = mesAtual()
  const nMedia = Math.max(1, parseInt(def("meses_media", "6"), 10) || 6)
  const reais = totaisPorCategoriaMes(movs)
  const ultimo = meses[meses.length - 1]
  const recsMes = recorrenciasPorMes(recsFiltradas(), atual, ultimo > atual ? ultimo : atual)
  const temRec = new Set(recsFiltradas().map((r) => r.categoria))

  // meses usados na média: os N meses completos antes do atual, sem recuar antes do 1.º registo
  const primeiro = movs.reduce((min, m) => { const k = ym(m); return !min || k < min ? k : min }, null)
  const janela = []
  for (let i = 1; i <= nMedia; i++) {
    const k = somarMesesYM(atual, -i)
    if (primeiro && k >= primeiro) janela.push(k)
  }

  const porCategoria = {}
  for (const c of state.cats) {
    const real = reais[c.id] || {}
    const somaJanela = janela.reduce((s, k) => s + (real[k] || 0), 0)
    const media = janela.length ? somaJanela / janela.length : 0
    const orcamento = Number(c.orcamento_mensal) || 0
    const res = { meses: {}, media }

    for (const k of meses) {
      const r = real[k] || 0
      if (k < atual) {
        res.meses[k] = { real: r, previsto: 0, valor: r, fonte: "real" }
        continue
      }
      const rec = recsMes[c.id]?.[k] || 0
      let base, fonte
      if (c.natureza === "fixa" && temRec.has(c.id)) { base = rec; fonte = "recorrência" }
      else if (janela.length && media > 0) { base = media + rec; fonte = rec ? "média + recorrência" : "média" }
      else if (rec) { base = rec; fonte = "recorrência" }
      else if (orcamento) { base = orcamento; fonte = "orçamento" }
      else { base = 0; fonte = "—" }

      if (k === atual) {
        const valor = Math.max(r, base)
        res.meses[k] = { real: r, previsto: Math.max(0, valor - r), valor, fonte: r >= base ? "real" : fonte }
      } else {
        res.meses[k] = { real: 0, previsto: base, valor: base, fonte }
      }
    }
    porCategoria[c.id] = res
  }
  return { porCategoria, mesesMedia: janela.length, nMedia }
}

export function mesesDoAno(ano) {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`)
}

// Totais por tipo (entrada/saída) e por mês a partir do resultado da previsão.
export function totaisTipo(prev, meses, tipo, filtroCat = () => true) {
  const out = meses.map(() => ({ real: 0, previsto: 0, valor: 0 }))
  for (const c of state.cats) {
    if (c.tipo !== tipo || !filtroCat(c)) continue
    meses.forEach((k, i) => {
      const v = prev.porCategoria[c.id]?.meses[k]
      if (!v) return
      out[i].real += v.real
      out[i].previsto += v.previsto
      out[i].valor += v.valor
    })
  }
  return out
}

// Total real de um ano (para comparar com anos anteriores).
export function totalAno(movs, ano, filtro = () => true) {
  const p = String(ano)
  return movs.filter((m) => dataISO(m.data).startsWith(p) && filtro(m)).reduce((s, m) => s + (Number(m.valor) || 0), 0)
}
