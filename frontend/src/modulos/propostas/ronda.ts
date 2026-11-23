export interface ValoresRonda {
  autor: string
  valor: string
  sinal_valor: string
  sinal_unidade: string
  modo_pagamento: string
  financiamento: string
  data_cpcv: string
  data_escritura: string
  validade: string
  condicoes: string
}

export const RONDA_VAZIA: ValoresRonda = {
  autor: 'comprador',
  valor: '',
  sinal_valor: '',
  sinal_unidade: 'percentagem',
  modo_pagamento: '',
  financiamento: '',
  data_cpcv: '',
  data_escritura: '',
  validade: '',
  condicoes: '',
}

const num = (v: string) => (v.trim() ? v.replace(/\s/g, '').replace(',', '.') : null)
const id = (v: string) => (v ? Number(v) : null)

export function rondaParaApi(r: ValoresRonda) {
  return {
    autor: r.autor,
    valor: num(r.valor),
    sinal_valor: num(r.sinal_valor),
    sinal_unidade: num(r.sinal_valor) === null ? '' : r.sinal_unidade,
    modo_pagamento: id(r.modo_pagamento),
    financiamento: id(r.financiamento),
    data_cpcv: r.data_cpcv || null,
    data_escritura: r.data_escritura || null,
    validade: r.validade || null,
    condicoes: r.condicoes,
  }
}
