import { describe, expect, it } from 'vitest'

import { combinar } from './disposicao'

const PADRAO = [
  { chave: 'a', titulo: 'A', campos: ['x', 'y'] },
  { chave: 'b', titulo: 'B', campos: ['z', 'w'] },
]

describe('combinar disposição (D-43)', () => {
  it('sem disposição guardada usa a de origem', () => {
    expect(combinar(PADRAO, null)).toEqual(PADRAO)
  })

  it('mantém a ordem guardada, ignora campos desconhecidos e acrescenta os campos novos', () => {
    const r = combinar(PADRAO, [
      { chave: 'b', titulo: 'Segundo', campos: ['w', 'x', 'antigo'] },
      { chave: 'novo', titulo: 'Novo', campos: ['z'] },
    ])
    expect(r).toEqual([
      { chave: 'b', titulo: 'Segundo', campos: ['w', 'x'] },
      { chave: 'novo', titulo: 'Novo', campos: ['z'] },
      // «y» não estava em lado nenhum: volta ao separador de origem, recriado no fim.
      { chave: 'a', titulo: 'A', campos: ['y'] },
    ])
  })
})
