import { fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, simularApi } from '../test/utilitarios'
import { Interacoes } from './Interacoes'

afterEach(() => vi.restoreAllMocks())

describe('Contactos registados', () => {
  it('um contacto pode ser corrigido (D-42)', async () => {
    const pedidos = simularApi({
      'GET /api/oportunidades/4/interacoes/': () =>
        json([
          {
            id: 9, tipo: 1, tipo_nome: 'Email', momento: '2026-11-20T10:00:00Z', resumo: 'Enviei avaliação',
            criado_por: 'Consultor Demo', anulada: false, editada_em: null, editada_por: null,
          },
        ]), // prettier-ignore
      'PATCH /api/oportunidades/4/interacoes/9/': () => json([]),
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Interacoes base="/api/oportunidades/4/interacoes/" podeEditar tipos={[{ id: 1, nome: 'Email' }]} />
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Resumo')).toHaveValue('Enviei avaliação')
    fireEvent.change(screen.getByLabelText('Resumo'), { target: { value: 'Enviei avaliação e CMI' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'PATCH')!.corpo).toMatchObject({
      tipo: 1,
      resumo: 'Enviei avaliação e CMI',
    })
  })
})
