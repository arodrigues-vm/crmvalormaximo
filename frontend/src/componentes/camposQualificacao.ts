/**
 * Campos de qualificação (D-34), descritos uma vez e usados no formulário e na ficha.
 * As listas vêm sempre das listas configuráveis (opções indexadas pela chave da lista).
 */
export interface CampoQualificacao {
  campo: string
  rotulo: string
  tipo: 'lista' | 'texto' | 'longo' | 'euros'
  /** Chave da lista configurável (tipo «lista»). */
  lista?: string
  /** Só mostra o campo quando outro campo de lista tem este valor (pelo nome). */
  mostrarSe?: { campo: string; nome: string }
  ajuda?: string
}

export type Opcoes = Record<string, { id: number; nome: string }[] | undefined>
export type Registo = Record<string, unknown> & { nomes?: Record<string, unknown> }

export function valoresQualificacao(campos: CampoQualificacao[], r?: Registo): Record<string, string> {
  return Object.fromEntries(
    campos.map((c) => {
      const v = r?.[c.campo]
      if (v === null || v === undefined) return [c.campo, '']
      if (c.tipo === 'euros') return [c.campo, String(Number(v))]
      return [c.campo, String(v)]
    }),
  )
}

export function qualificacaoParaApi(campos: CampoQualificacao[], v: Record<string, string>) {
  return Object.fromEntries(
    campos.map((c) => {
      const x = (v[c.campo] ?? '').trim()
      if (c.tipo === 'lista') return [c.campo, x ? Number(x) : null]
      if (c.tipo === 'euros') return [c.campo, x ? x.replace(/\s/g, '').replace(',', '.') : null]
      return [c.campo, v[c.campo] ?? '']
    }),
  )
}
