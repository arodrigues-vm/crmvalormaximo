import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar'].map((o) => [o, a])) as Record<string, string>

const U = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, 'pos-venda': todas('atribuidos') },
}

const OPCOES = {
  estados: [
    { id: 1, nome: 'Por fazer', categoria: 'aberta' },
    { id: 3, nome: 'Concluída', categoria: 'concluida' },
  ],
  prioridades: [],
  categorias: [{ id: 7, nome: 'Pós-venda', categoria: 'pos_venda' }],
  tipos_interacao: [],
  pode_criar: true,
}

const TAREFA = {
  id: 4,
  referencia: 'TAR-000004',
  titulo: 'Mudança de contadores',
  estado: 1,
  estado_nome: 'Por fazer',
  estado_categoria: 'aberta',
  prioridade: null,
  prioridade_nome: null,
  prazo: '2026-11-20',
  atrasada: true,
  transacao: 9,
  transacao_referencia: 'TRA-000009',
  cliente_nome: 'Bruno Ensaio',
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  criado_em: '2026-11-13T10:00:00Z',
  descricao: '',
  categoria: 7,
  concluida_em: null,
  modelo_nome: 'Mudança de contadores',
  imovel_descricao: 'Apartamento T2 · Maia',
  atualizado_em: '2026-11-13T10:00:00Z',
  versao: 1,
  acoes: { editar: true, eliminar: true, transferir: false },
}

afterEach(() => vi.restoreAllMocks())

describe('Pós-Venda (D-50)', () => {
  it('a lista mostra as tarefas atrasadas e muda de separador', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/tarefas/opcoes/': () => json(OPCOES),
      'GET /api/tarefas/': () => json({ count: 1, results: [TAREFA] }),
    })
    desenhar('/pos-venda')
    expect(await screen.findByText('Mudança de contadores')).toBeInTheDocument()
    expect(screen.getByText('Atrasada')).toBeInTheDocument()
    expect(pedidos.find((p) => p.url.pathname === '/api/tarefas/')!.url.searchParams.get('vista')).toBe('abertas')
    fireEvent.click(screen.getByRole('tab', { name: 'Concluídas' }))
    await waitFor(() => expect(pedidos.some((p) => p.url.searchParams.get('vista') === 'concluidas')).toBe(true))
  })

  it('marcar como concluída envia o estado da categoria «concluída»', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/tarefas/opcoes/': () => json(OPCOES),
      'GET /api/tarefas/4/': () => json(TAREFA),
      'PATCH /api/tarefas/4/': () => json({ ...TAREFA, estado: 3, estado_categoria: 'concluida', versao: 2 }),
    })
    desenhar('/pos-venda/4')
    expect(await screen.findByText('TRA-000009')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como concluída' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'PATCH')!.corpo).toEqual({ estado: 3, versao: 1 })
    expect(await screen.findByRole('button', { name: 'Reabrir' })).toBeInTheDocument()
  })

  it('o Administrador cria um modelo de tarefa', async () => {
    const admin = { ...U, perfil: 'administrador', permissoes: { ...U.permissoes, configuracoes: todas('todos') } }
    admin.permissoes.configuracoes.administrar = 'todos'
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(admin),
      'GET /api/modelos-tarefa/': () =>
        json([{ id: 1, nome: 'Mudança de contadores', descricao: '', dias_apos: 7, ativo: true, ordem: 1 }]),
      'POST /api/modelos-tarefa/': () => json({ id: 2 }, 201),
    })
    desenhar('/configuracoes/modelos-tarefa')
    expect(await screen.findByText('7 dias depois')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Novo modelo' }))
    fireEvent.change(screen.getByLabelText('Nome da tarefa'), { target: { value: 'Pedir testemunho' } })
    fireEvent.change(screen.getByLabelText('Dias depois da escritura / contrato'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({ nome: 'Pedir testemunho', dias_apos: 60 })
  })
})

describe('Pós-venda na transação (D-50)', () => {
  it('propõe as tarefas dos modelos e cria só as marcadas; mostra os documentos em falta', async () => {
    const { PosVendaTransacao, DocumentosNegocio } = await import('./PosVendaTransacao')
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
    const { render } = await import('@testing-library/react')
    const { MemoryRouter } = await import('react-router-dom')
    const pedidos = simularApi({
      'GET /api/tarefas/': () => json({ count: 0, results: [] }),
      '/api/tarefas/proposta/': () =>
        json([
          { id: 1, nome: 'Mudança de contadores', descricao: '', dias_apos: 7 },
          { id: 2, nome: 'Aniversário da compra', descricao: '', dias_apos: 365 },
        ]),
      'POST /api/tarefas/criar-de-modelos/': () => json([], 201),
      '/api/transacoes/9/documentos/': () =>
        json([
          { tipo: 50, nome: 'Escritura de compra e venda', ligacoes: [] },
          { tipo: 51, nome: 'Certificado energético', ligacoes: [{ id: 1, titulo: 'CE', url: 'https://x.pt' }] },
        ]),
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <PosVendaTransacao transacao={9} podeCriar />
          <DocumentosNegocio transacao={9} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Sem tarefas de pós-venda.')).toBeInTheDocument()
    expect(await screen.findByText('em falta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CE ↗' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Propor tarefas dos modelos' }))
    const dialogo = within(await screen.findByRole('dialog'))
    fireEvent.click(await dialogo.findByLabelText(/Aniversário da compra/))
    fireEvent.click(dialogo.getByRole('button', { name: 'Criar as tarefas marcadas' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ transacao: 9, modelos: [1] })
  })
})
