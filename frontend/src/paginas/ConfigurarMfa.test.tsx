import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'

import { ProvedorSessao } from '../app/sessao'
import { ConfigurarMfa } from './ConfigurarMfa'

afterEach(() => vi.restoreAllMocks())

it('em StrictMode pede o segredo uma só vez e mostra-o (regressão)', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).includes('/mfa/configurar/'))
      return new Response(JSON.stringify({ segredo: 'ABCDEF234567', uri: 'otpauth://totp/x?secret=ABCDEF234567' }), {
        headers: { 'content-type': 'application/json' },
      })
    return new Response(null, { status: 204 })
  })
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ProvedorSessao>
            <ConfigurarMfa />
          </ProvedorSessao>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
  expect(await screen.findByText('ABCDEF234567')).toBeInTheDocument()
  const pedidos = fetch.mock.calls.filter(([u]) => String(u).includes('/mfa/configurar/'))
  expect(pedidos).toHaveLength(1)
})
