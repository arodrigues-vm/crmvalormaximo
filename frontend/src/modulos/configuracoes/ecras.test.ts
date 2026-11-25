import { describe, expect, it } from 'vitest'

import { ECRAS } from './ecras'

describe('Ecrãs com disposição configurável (D-43)', () => {
  it('cada ecrã tem identificador único, campos sem repetições e todos com nome', () => {
    expect(new Set(ECRAS.map((e) => e.modulo)).size).toBe(ECRAS.length)
    for (const e of ECRAS) {
      const campos = e.padrao.flatMap((b) => b.campos)
      expect(new Set(campos).size, e.modulo).toBe(campos.length)
      expect(new Set(e.padrao.map((b) => b.chave)).size, e.modulo).toBe(e.padrao.length)
      for (const c of campos) expect(e.rotulos[c], `${e.modulo}.${c}`).toBeTruthy()
    }
  })
})
