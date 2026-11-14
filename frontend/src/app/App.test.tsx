import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

function desenhar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mostra a navegação com os módulos e o estado operacional', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ estado: 'ok', base_dados: 'ok', ambiente: 'dev' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    desenhar()
    expect(screen.getByText('Transações')).toBeInTheDocument()
    expect(screen.getByText('Faturação e Comissões')).toBeInTheDocument()
    expect(await screen.findByText('Operacional')).toBeInTheDocument()
  })

  it('indica servidor indisponível quando a API falha', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('falha de rede'))
    desenhar()
    expect(await screen.findByText('Servidor indisponível')).toBeInTheDocument()
  })
})
