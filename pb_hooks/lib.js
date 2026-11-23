// Funções partilhadas pelos hooks (carregadas com require() dentro de cada handler).

const PASSO_MESES = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }

function pad(n) { return String(n).padStart(2, "0") }

function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function somarDias(iso, dias) {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}

// Soma meses mantendo o dia "pretendido" (ex.: 31 -> 28/30/31 conforme o mês).
function somarMeses(iso, meses, diaPretendido) {
  const [y, m] = iso.split("-").map(Number)
  const total = (m - 1) + meses
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(diaPretendido, ultimo))}`
}

function paraDataPB(iso) { return `${iso} 12:00:00.000Z` }

function definicao(app, chave, omissao) {
  try {
    const r = app.findFirstRecordByData("definicoes", "chave", chave)
    const v = r.getString("valor")
    return v === "" ? omissao : v
  } catch (_) {
    return omissao
  }
}

// Lança os movimentos das recorrências cuja próxima data já chegou.
// Devolve o número de movimentos criados.
function gerarRecorrencias(app) {
  const antecedencia = parseInt(definicao(app, "antecedencia_recorrencias", "0"), 10) || 0
  const limite = somarDias(hoje(), Math.max(0, antecedencia))
  let criados = 0

  app.runInTransaction((tx) => {
    const movimentos = tx.findCollectionByNameOrId("movimentos")
    const recs = tx.findRecordsByFilter(
      "recorrencias",
      "ativo = true && proxima_data <= {:lim}",
      "", 0, 0,
      { lim: `${limite} 23:59:59.999Z` },
    )

    for (const rec of recs) {
      let prox = rec.getString("proxima_data").slice(0, 10)
      const fim = rec.getString("data_fim").slice(0, 10)
      const passo = PASSO_MESES[rec.getString("periodicidade")] || 1
      const dia = Number(prox.slice(8, 10))
      let guarda = 0

      while (prox <= limite && (!fim || prox <= fim) && guarda++ < 120) {
        const existente = tx.findRecordsByFilter(
          "movimentos",
          "recorrencia = {:r} && data >= {:d0} && data <= {:d1}",
          "", 1, 0,
          { r: rec.id, d0: `${prox} 00:00:00.000Z`, d1: `${prox} 23:59:59.999Z` },
        )
        if (existente.length === 0) {
          const m = new Record(movimentos)
          m.load({
            data: paraDataPB(prox),
            tipo: rec.getString("tipo"),
            ambito: rec.getString("ambito"),
            categoria: rec.getString("categoria"),
            valor: rec.getFloat("valor"),
            fornecedor: rec.getString("fornecedor"),
            metodo_pagamento: rec.getString("metodo_pagamento"),
            responsavel: rec.getString("responsavel"),
            pago: rec.getBool("pago_automatico"),
            descricao: rec.getString("descricao"),
            recorrencia: rec.id,
          })
          tx.save(m)
          criados++
        }
        prox = somarMeses(prox, passo, dia)
      }

      rec.set("proxima_data", paraDataPB(prox))
      if (fim && prox > fim) rec.set("ativo", false)
      tx.save(rec)
    }
  })

  return criados
}

// O tipo (entrada/saída) do movimento tem de coincidir com o da categoria.
function validarTipoCategoria(app, record) {
  const catId = record.getString("categoria")
  if (!catId) return
  const cat = app.findRecordById("categorias", catId)
  if (cat.getString("tipo") !== record.getString("tipo")) {
    throw new BadRequestError("A categoria escolhida não corresponde ao tipo de movimento.", {
      categoria: new ValidationError("tipo_incompativel", "Categoria de " +
        (cat.getString("tipo") === "entrada" ? "receita" : "despesa")),
    })
  }
}

module.exports = { gerarRecorrencias, validarTipoCategoria, hoje }
