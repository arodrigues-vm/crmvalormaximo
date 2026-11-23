// Movimentos recorrentes (renda, salário, subscrições, seguros…): lançados automaticamente na data.
import {
  pb, state, h, eur, abrirModal, fecharModal, aviso, erroTexto, confirmar, dataISO, dataCurta, paraPB,
  hojeISO, nomeDe, rotulo, recarregar,
} from "../core.js"
import { opcoesCategorias, selectSimples, resolverFornecedor } from "./form-movimento.js"

const POR_MES = { mensal: 1, bimestral: 1 / 2, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 }

export function render(el) {
  const recs = [...state.recs].sort((a, b) => Number(b.ativo) - Number(a.ativo) || (a.proxima_data || "").localeCompare(b.proxima_data || ""))
  const mensal = (tipo) => state.recs.filter((r) => r.ativo && r.tipo === tipo).reduce((s, r) => s + r.valor * (POR_MES[r.periodicidade] || 1), 0)

  el.append(
    h("div", { class: "pagina-topo" }, h("h1", {}, "Movimentos recorrentes"),
      h("div", { class: "acoes-topo" },
        h("button", { class: "btn", onclick: lancarAgora, title: "Lança já os movimentos cuja data chegou" }, "Lançar pendentes"),
        h("button", { class: "btn btn-primario", onclick: () => abrirForm() }, "Nova recorrência"))),
    h("p", { class: "sub" }, "Os movimentos recorrentes são lançados automaticamente todos os dias às 06:05, na data prevista. Servem também de base à previsão das despesas fixas."),
    h("div", { class: "tiles" },
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, "Despesas fixas (equivalente mensal)"), h("strong", { class: "tile-valor" }, eur(mensal("saida")))),
      h("div", { class: "tile" }, h("span", { class: "tile-rotulo" }, "Receitas fixas (equivalente mensal)"), h("strong", { class: "tile-valor" }, eur(mensal("entrada"))))),
  )

  el.append(h("section", { class: "cartao" }, recs.length
    ? h("div", { class: "tabela-scroll" }, h("table", { class: "tabela tabela-clicavel" },
      h("thead", {}, h("tr", {}, ["Descrição", "Categoria", "Valor", "Periodicidade", "Próxima data", "Estado"].map((t, i) =>
        h("th", { class: i === 2 ? "num" : "" }, t)))),
      h("tbody", {}, recs.map((r) => h("tr", { tabindex: 0, onclick: () => abrirForm(r), onkeydown: (e) => e.key === "Enter" && abrirForm(r) },
        h("th", { scope: "row" }, r.descricao, r.ambito === "profissional" ? h("span", { class: "etiqueta" }, "Profissional") : null),
        h("td", {}, nomeDe(state.cats, r.categoria)),
        h("td", { class: "num" }, `${r.tipo === "entrada" ? "+" : "−"}${eur(r.valor)}`),
        h("td", {}, rotulo(r.periodicidade)),
        h("td", {}, dataCurta(dataISO(r.proxima_data))),
        h("td", {}, r.ativo ? "Ativa" : h("span", { class: "apagado" }, "Inativa")))))))
    : h("p", { class: "vazio" }, "Ainda não há recorrências. Registe aqui as despesas e receitas que se repetem (renda, EDP, Vodafone, salário, seguro…).")))
}

async function lancarAgora() {
  try {
    const r = await pb.send("/api/orc/recorrencias/gerar", { method: "POST" })
    aviso(r.criados ? `${r.criados} movimento(s) lançados.` : "Não há movimentos recorrentes por lançar.", "ok")
    await recarregar()
  } catch (err) { aviso(erroTexto(err), "erro") }
}

function abrirForm(r = null) {
  const x = r || { tipo: "saida", periodicidade: "mensal", proxima_data: paraPB(hojeISO()), ativo: true, pago_automatico: true }
  let tipo = x.tipo
  const selCat = h("select", { name: "categoria", required: true })
  opcoesCategorias(selCat, tipo, x.categoria)
  const selTipo = h("select", { name: "tipo", onchange: (e) => { tipo = e.target.value; opcoesCategorias(selCat, tipo, "") } },
    h("option", { value: "saida", selected: tipo === "saida" }, "Despesa"),
    h("option", { value: "entrada", selected: tipo === "entrada" }, "Receita"))
  const selAmb = h("select", { name: "ambito", required: true },
    ["pessoal", "profissional"].map((v) => h("option", { value: v, selected: x.ambito === v }, rotulo(v))))
  selCat.addEventListener("change", () => {
    const c = state.cats.find((k) => k.id === selCat.value)
    if (c?.ambito_padrao && !r) selAmb.value = c.ambito_padrao
  })
  const erro = h("p", { class: "erro", role: "alert" })
  const campo = (t, i) => h("label", { class: "campo" }, h("span", {}, t), i)

  const form = h("form", { class: "form" },
    campo("Descrição", h("input", { name: "descricao", required: true, maxlength: 120, value: x.descricao || "", placeholder: "Ex.: Vodafone fibra" })),
    h("div", { class: "grelha-2" }, campo("Tipo", selTipo), campo("Âmbito", selAmb)),
    campo("Categoria", selCat),
    h("div", { class: "grelha-2" },
      campo("Valor (€)", h("input", { name: "valor", type: "number", min: "0.01", step: "0.01", required: true, inputmode: "decimal", value: x.valor ?? "" })),
      campo("Periodicidade", h("select", { name: "periodicidade" },
        ["mensal", "bimestral", "trimestral", "semestral", "anual"].map((v) => h("option", { value: v, selected: x.periodicidade === v }, rotulo(v)))))),
    h("div", { class: "grelha-2" },
      campo("Próxima data", h("input", { name: "proxima_data", type: "date", required: true, value: dataISO(x.proxima_data) })),
      campo("Termina em (opcional)", h("input", { name: "data_fim", type: "date", value: dataISO(x.data_fim) }))),
    h("div", { class: "grelha-2" },
      campo("Fornecedor / Entidade", h("input", { name: "fornecedor_nome", list: "lista-forn-rec", value: nomeDe(state.forn, x.fornecedor) })),
      campo("Método de pagamento", selectSimples("metodo_pagamento", state.metodos, x.metodo_pagamento))),
    h("datalist", { id: "lista-forn-rec" }, state.forn.map((f) => h("option", { value: f.nome }))),
    campo("Responsável", selectSimples("responsavel", state.resp, x.responsavel)),
    h("label", { class: "campo-check" }, h("input", { type: "checkbox", name: "pago_automatico", checked: x.pago_automatico }), "Marcar como pago ao lançar (ex.: débito direto)"),
    h("label", { class: "campo-check" }, h("input", { type: "checkbox", name: "ativo", checked: x.ativo }), "Ativa"),
    erro,
    h("div", { class: "acoes" },
      r ? h("button", { type: "button", class: "btn btn-perigo-texto", onclick: eliminar }, "Eliminar") : null,
      h("span", { class: "espaco" }),
      h("button", { type: "submit", class: "btn btn-primario" }, "Guardar")))

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    erro.textContent = ""
    const fd = new FormData(form)
    try {
      const dados = {
        descricao: fd.get("descricao"), tipo, ambito: fd.get("ambito"), categoria: fd.get("categoria"),
        valor: Number(fd.get("valor")), periodicidade: fd.get("periodicidade"),
        proxima_data: paraPB(fd.get("proxima_data")), data_fim: fd.get("data_fim") ? paraPB(fd.get("data_fim")) : "",
        fornecedor: await resolverFornecedor(fd.get("fornecedor_nome"), fd.get("categoria")),
        metodo_pagamento: fd.get("metodo_pagamento"), responsavel: fd.get("responsavel"),
        pago_automatico: fd.get("pago_automatico") === "on", ativo: fd.get("ativo") === "on",
      }
      if (r) await pb.collection("recorrencias").update(r.id, dados)
      else await pb.collection("recorrencias").create(dados)
      fecharModal()
      aviso("Recorrência guardada.", "ok")
      if (dados.ativo && dataISO(dados.proxima_data) <= hojeISO()) await lancarAgora()
      else await recarregar()
    } catch (err) { erro.textContent = erroTexto(err) }
  })

  async function eliminar() {
    if (!(await confirmar("Eliminar esta recorrência? Os movimentos já lançados mantêm-se."))) return
    try { await pb.collection("recorrencias").delete(r.id); aviso("Recorrência eliminada.", "ok"); await recarregar() }
    catch (err) { aviso(erroTexto(err), "erro") }
  }

  abrirModal(r ? "Editar recorrência" : "Nova recorrência", form)
}
