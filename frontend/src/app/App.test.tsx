import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { rotas } from './App'
import { ProvedorSessao } from './sessao'

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

const todos = { consultar: 'todos' }
const nenhum = { consultar: 'nenhum' }

function utilizador(permissoes: Record<string, Record<string, string>>) {
  return { id: 1, email: 'a@x.pt', nome: 'Ana Demo', perfil: 'consultor', perfil_nome: 'Consultor', permissoes }
}

function simularApi(rotas: Record<string, () => Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const chave = Object.keys(rotas).find((r) => String(url).startsWith(r))
    return chave ? rotas[chave]() : json({}, 404)
  })
}

function desenhar(caminho = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ProvedorSessao>
        <RouterProvider router={createMemoryRouter(rotas, { initialEntries: [caminho] })} />
      </ProvedorSessao>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sem sessão mostra o ecrã de entrada', async () => {
    simularApi({ '/api/auth/eu/': () => json({ detail: 'x' }, 401) })
    desenhar('/')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('com sessão mostra apenas os módulos permitidos', async () => {
    simularApi({
      '/api/auth/eu/': () => json(utilizador({ dashboard: todos, entidades: todos, faturacao: nenhum })),
      '/api/saude/': () => json({ estado: 'ok', base_dados: 'ok', ambiente: 'dev' }),
    })
    desenhar('/')
    expect(await screen.findByText('Operacional')).toBeInTheDocument()
    expect(screen.getByText('Entidades')).toBeInTheDocument()
    expect(screen.queryByText('Faturação e Comissões')).not.toBeInTheDocument()
    expect(screen.getByText('Ana Demo')).toBeInTheDocument()
  })

  it('credenciais erradas mostram a mensagem do servidor', async () => {
    simularApi({
      '/api/auth/eu/': () => json({ detail: 'x' }, 401),
      '/api/auth/csrf/': () => new Response(null, { status: 204 }),
      '/api/auth/entrar/': () => json({ detail: 'Email ou palavra-passe incorretos.' }, 400),
    })
    desenhar('/entrar')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@x.pt' } })
    fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou palavra-passe incorretos.')
  })
  it('após entrar com sucesso mostra a aplicação (regressão: cache da sessão)', async () => {
    let autenticado = false
    simularApi({
      '/api/auth/eu/': () => (autenticado ? json(utilizador({ dashboard: todos })) : json({ detail: 'x' }, 401)),
      '/api/auth/csrf/': () => new Response(null, { status: 204 }),
      '/api/auth/entrar/': () => {
        autenticado = true
        return json(utilizador({ dashboard: todos }))
      },
      '/api/saude/': () => json({ estado: 'ok', base_dados: 'ok', ambiente: 'dev' }),
    })
    desenhar('/')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@x.pt' } })
    fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: 'certa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Operacional')).toBeInTheDocument()
  })
})
