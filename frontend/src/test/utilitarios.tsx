import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { vi } from 'vitest'

import { rotas } from '../app/App'
import { ProvedorSessao } from '../app/sessao'

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

type Rota = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>

/** Simula a API: chave "MÉTODO /caminho" ou "/caminho" (qualquer método). Regista os pedidos. */
export function simularApi(rotasApi: Record<string, Rota>) {
  const pedidos: { metodo: string; url: URL; corpo: unknown }[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init) => {
    const url = new URL(String(entrada), 'http://localhost')
    const metodo = (init?.method ?? 'GET').toUpperCase()
    const corpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    pedidos.push({ metodo, url, corpo })
    const chaves = Object.keys(rotasApi).sort((a, b) => b.length - a.length)
    const chave = chaves.find((k) => {
      const [m, c] = k.includes(' ') ? k.split(' ') : [null, k]
      return (!m || m === metodo) && url.pathname === c
    })
    if (url.pathname === '/api/auth/csrf/') return new Response(null, { status: 204 })
    return chave ? rotasApi[chave](url, init) : json({ detail: 'não simulado' }, 404)
  })
  return pedidos
}

const todas = (amb: string) =>
  Object.fromEntries(
    [
      'consultar',
      'criar',
      'editar',
      'eliminar',
      'restaurar',
      'aprovar',
      'exportar',
      'partilhar',
      'transferir',
      'administrar',
    ].map((o) => [o, amb]),
  )

export const UTILIZADOR_CONSULTOR = {
  id: 1,
  email: 'consultor@demo.local',
  nome: 'Consultor Demo',
  perfil: 'consultor',
  perfil_nome: 'Consultor',
  equipa: null,
  equipa_nome: null,
  mfa_ativa: false,
  mfa_configuracao_pendente: false,
  permissoes: { dashboard: todas('atribuidos'), entidades: todas('atribuidos') },
}

export function desenhar(caminho: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] })
  const r = render(
    <QueryClientProvider client={qc}>
      <ProvedorSessao>
        <RouterProvider router={router} />
      </ProvedorSessao>
    </QueryClientProvider>,
  )
  return { ...r, router }
}
