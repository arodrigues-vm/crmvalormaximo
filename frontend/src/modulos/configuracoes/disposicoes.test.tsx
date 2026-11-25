import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const ADMIN = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: {
    ...UTILIZADOR_CONSULTOR.permissoes,
    configuracoes: Object.fromEntries(['consultar', 'editar', 'administrar'].map((o) => [o, 'todos'])),
  },
}

afterEach(() => vi.restoreAllMocks())

describe('Disposição dos ecrãs (D-43)', () => {
  it('o Administrador muda a ordem, move um campo para outro separador e guarda', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/disposicoes/imoveis/': () => json({ modulo: 'imoveis', blocos: null }),
      'GET /api/disposicoes/entidades/': () => json({ modulo: 'entidades', blocos: null }),
      'PUT /api/disposicoes/imoveis/': (_u, init) =>
        json({ modulo: 'imoveis', blocos: JSON.parse(String(init?.body)).blocos }),
    })
    desenhar('/configuracoes/disposicao')
    fireEvent.change(await screen.findByLabelText('Módulo'), { target: { value: 'imoveis' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Descer o separador Comercialização' }))
    const separadores = screen.getAllByLabelText(/^Separador \d+$/)
    expect(separadores[0]).toHaveValue('Identificação')
    fireEvent.change(screen.getByLabelText('Separador de Valor'), { target: { value: 'identificacao' } })
    fireEvent.change(separadores[0], { target: { value: 'Identificação do imóvel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PUT')).toBe(true))
    const blocos = (
      pedidos.find((p) => p.metodo === 'PUT')!.corpo as {
        blocos: { chave: string; titulo: string; campos: string[] }[]
      }
    ).blocos
    expect(blocos[0]).toMatchObject({ chave: 'identificacao', titulo: 'Identificação do imóvel' })
    expect(blocos[0].campos.at(-1)).toBe('preco')
    expect(blocos[1].chave).toBe('comercializacao')
    expect(blocos[1].campos).not.toContain('preco')
    expect(await screen.findByText('Disposição guardada.')).toBeInTheDocument()
  })

  it('só deixa remover separadores vazios', async () => {
    simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/disposicoes/entidades/': () => json({ modulo: 'entidades', blocos: null }),
    })
    desenhar('/configuracoes/disposicao')
    await screen.findByRole('button', { name: 'Acrescentar separador' })
    expect(screen.queryByRole('button', { name: /^Remover o separador/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Acrescentar separador' }))
    const novo = screen.getByRole('button', { name: 'Remover o separador Novo separador' })
    expect(within(novo.closest('li')!).getByText(/Separador vazio/)).toBeInTheDocument()
    fireEvent.click(novo)
    expect(screen.queryByDisplayValue('Novo separador')).toBeNull()
  })
})
