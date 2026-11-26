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
  origens: [{ valor: 'entidades', nome: 'Entidades' }],
  modulos_modelo: [
    { valor: 'pos-venda', nome: 'Pós-Venda' },
    { valor: 'entidades', nome: 'Entidades' },
  ],
  pode_criar: true,
  pode_criar_pos_venda: true,
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
  pos_venda: true,
  origem: null,
  origem_modulo: '',
  origem_id: null,
  motivo_estado: '',
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
      'POST /api/tarefas/4/mudar-estado/': () =>
        json({ ...TAREFA, estado: 3, estado_categoria: 'concluida', versao: 2 }),
    })
    desenhar('/pos-venda/4')
    expect(await screen.findByText('TRA-000009')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como concluída' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ estado: 3, motivo: '' })
    expect(await screen.findByRole('button', { name: 'Reabrir' })).toBeInTheDocument()
  })

  it('o Administrador cria um modelo de tarefa', async () => {
    const admin = { ...U, perfil: 'administrador', permissoes: { ...U.permissoes, configuracoes: todas('todos') } }
    admin.permissoes.configuracoes.administrar = 'todos'
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(admin),
      'GET /api/modelos-tarefa/': () =>
        json([
          {
            id: 1,
            modulo: 'pos-venda',
            modulo_nome: 'Pós-Venda',
            nome: 'Mudança de contadores',
            descricao: '',
            dias_apos: 7,
            ativo: true,
            ordem: 1,
          },
        ]),
      '/api/tarefas/opcoes/': () => json(OPCOES),
      'POST /api/modelos-tarefa/': () => json({ id: 2 }, 201),
    })
    desenhar('/configuracoes/modelos-tarefa')
    expect(await screen.findByText('7 dias depois')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Novo modelo' }))
    fireEvent.change(screen.getByLabelText('Nome da tarefa'), { target: { value: 'Pedir testemunho' } })
    fireEvent.change(screen.getByLabelText('Dias depois da escritura / contrato'), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      modulo: 'pos-venda',
      nome: 'Pedir testemunho',
      dias_apos: 60,
    })
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

const GERAL = {
  ...TAREFA,
  id: 8,
  referencia: 'TAR-000008',
  titulo: 'Ligar à Ana',
  pos_venda: false,
  transacao: null,
  transacao_referencia: null,
  cliente_nome: null,
  estado: 3,
  estado_nome: 'Concluída',
  estado_categoria: 'concluida',
  atrasada: false,
  origem: { modulo: 'entidades', modulo_nome: 'Entidades', id: 5, titulo: 'ENT-000005 · Ana', caminho: '/entidades/5' },
}

describe('Tarefas gerais (D-52)', () => {
  it('no quadro, reabrir uma tarefa concluída pede o motivo', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json({ ...U, permissoes: { ...U.permissoes, tarefas: todas('atribuidos') } }),
      '/api/tarefas/opcoes/': () => json(OPCOES),
      '/api/tarefas/kanban/': () => json([GERAL]),
      'POST /api/tarefas/8/mudar-estado/': () => json({ ...GERAL, estado: 1 }),
    })
    desenhar('/tarefas?modo=kanban')
    const coluna = await screen.findByRole('listitem', { name: 'Concluída' })
    expect(within(coluna).getByText('Ligar à Ana')).toBeInTheDocument()
    expect(within(coluna).getByText('ENT-000005 · Ana')).toBeInTheDocument()
    fireEvent.change(within(coluna).getByLabelText('Mover «Ligar à Ana» para'), { target: { value: '1' } })
    const dialogo = within(await screen.findByRole('dialog'))
    fireEvent.change(dialogo.getByLabelText('Motivo'), { target: { value: 'Cliente não atendeu' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ estado: 1, motivo: 'Cliente não atendeu' })
  })

  it('nova tarefa a partir de uma ficha fica ligada a essa ficha', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json({ ...U, permissoes: { ...U.permissoes, tarefas: todas('atribuidos') } }),
      '/api/tarefas/opcoes/': () => json(OPCOES),
      'POST /api/tarefas/': () => json({ ...GERAL, estado: 1 }, 201),
      'GET /api/tarefas/8/': () => json({ ...GERAL, estado: 1 }),
    })
    desenhar('/tarefas/nova?origem_modulo=entidades&origem_id=5&origem_titulo=Ana')
    expect(await screen.findByDisplayValue('Ana')).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Ligar à Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    const corpo = pedidos.find((p) => p.metodo === 'POST')!.corpo as Record<string, unknown>
    expect(corpo).toMatchObject({ titulo: 'Ligar à Ana', origem_modulo: 'entidades', origem_id: 5 })
    expect(corpo).not.toHaveProperty('transacao')
  })
})
