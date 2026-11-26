import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProvedorSessao } from '../../app/sessao'
import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'
import { PlanoBloco } from './PlanoBloco'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar', 'aprovar'].map((o) => [o, a])) as Record<
    string,
    string
  >

const U = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: {
    ...UTILIZADOR_CONSULTOR.permissoes,
    'marketing-imoveis': todas('atribuidos'),
    tarefas: todas('atribuidos'),
  },
}

const semanas = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
  semana: s,
  incluidas: s === 1 ? 2 : 0,
  concluidas: s === 1 ? 1 : 0,
  cor: s === 1 ? 'amarelo' : 'neutro',
}))

const oc = (id: number, n: number, titulo: string, extra = {}) => ({
  id,
  referencia: `TAR-0000${id}`,
  titulo,
  estado: 1,
  estado_nome: 'Por fazer',
  estado_categoria: 'aberta',
  prioridade: null,
  prioridade_nome: null,
  prazo: '2026-11-02',
  atrasada: false,
  pos_venda: false,
  marketing: true,
  plano: 3,
  plano_referencia: 'PMK-000003',
  mk_numero: n,
  mk_semana: 1,
  incluida: true,
  transacao: null,
  transacao_referencia: null,
  cliente_nome: null,
  origem: null,
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  criado_em: '2026-11-02T10:00:00Z',
  ...extra,
})

const PLANO = {
  id: 3,
  referencia: 'PMK-000003',
  imovel: 7,
  imovel_descricao: 'IMO-000007 · Apartamento T2 · Maia',
  angariacao: 4,
  angariacao_referencia: 'CMI-000004',
  ciclo: 1,
  data_base: '2026-11-02',
  ativo: true,
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  indicadores: { semanas, incluidas: 2, concluidas: 1, cor: 'amarelo', total: 3 },
  criado_em: '2026-11-02T10:00:00Z',
  ocorrencias: [
    oc(11, 1, 'Análise Concorencia', { estado: 3, estado_nome: 'Concluída', estado_categoria: 'concluida' }),
    oc(12, 2, 'Video de pré angariação'),
    oc(13, 3, 'Análise swot', { incluida: false }),
  ],
  angariacao_data_inicio: '2026-11-05',
  pedido_pendente: null,
  pedidos: [],
  plano_anterior: null,
  plano_anterior_referencia: null,
  ciclos_seguintes: [],
  renovacao: null,
  renovacao_data_inicio: null,
  origem_ciclo: '',
  destino_pendentes: '',
  observacoes: '',
  atualizado_em: '2026-11-02T10:00:00Z',
  versao: 1,
  acoes: { editar: true, eliminar: true, transferir: false, aprovar: false },
}

afterEach(() => vi.restoreAllMocks())

describe('Plano de Marketing de Imóveis (D-53)', () => {
  it('a ficha mostra as semanas com cor, inclui uma ocorrência e permite pedir o recálculo', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/tarefas/opcoes/': () => json({ estados: [], prioridades: [], categorias: [], tipos_interacao: [] }),
      'GET /api/planos-marketing/3/': () => json(PLANO),
      'POST /api/planos-marketing/3/incluir/': () => json(PLANO),
      '/api/planos-marketing/3/previa-recalculo/': () =>
        json({
          data_base_atual: '2026-11-02',
          data_base_nova: '2026-11-05',
          ocorrencias: [
            {
              tarefa: 12,
              numero: 2,
              titulo: 'Video de pré angariação',
              prazo_atual: '2026-11-02',
              prazo_novo: '2026-11-05',
            },
          ],
        }),
      'POST /api/planos-marketing/3/pedir-recalculo/': () => json(PLANO, 201),
    })
    desenhar('/marketing-imoveis/3')
    const semana1 = await screen.findByTitle(/Semana 1: 1 de 2 concluídas/)
    expect(semana1).toHaveClass('cor-amarelo')
    expect(screen.getByTitle(/Semana 2: 0 de 0/)).toHaveClass('cor-neutro')
    // Uma concluída não se desmarca; a não incluída marca-se.
    expect(screen.getByLabelText('Incluir 1. Análise Concorencia')).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Incluir 3. Análise swot'))
    await waitFor(() => expect(pedidos.some((p) => p.url.pathname.endsWith('/incluir/'))).toBe(true))
    expect(pedidos.find((p) => p.url.pathname.endsWith('/incluir/'))!.corpo).toEqual({ tarefa: 13, incluida: true })
    // A data do CMI mudou: pedir recálculo com motivo.
    fireEvent.click(screen.getByRole('button', { name: 'Pedir recálculo dos prazos' }))
    const dialogo = within(await screen.findByRole('dialog'))
    expect(await dialogo.findByText(/Video de pré angariação: 02\/11\/2026 → 05\/11\/2026/)).toBeInTheDocument()
    fireEvent.change(dialogo.getByLabelText('Motivo'), { target: { value: 'Data corrigida' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Enviar pedido' }))
    await waitFor(() => expect(pedidos.some((p) => p.url.pathname.endsWith('/pedir-recalculo/'))).toBe(true))
    expect(pedidos.find((p) => p.url.pathname.endsWith('/pedir-recalculo/'))!.corpo).toEqual({
      motivo: 'Data corrigida',
    })
  })

  it('criar plano inicial: prévia com 45 marcadas, desmarcar uma e confirmar', async () => {
    const ocorrencias = Array.from({ length: 45 }, (_, i) => ({
      numero: i + 1,
      semana: Math.min(8, Math.floor(i / 6) + 1),
      designacao: `Tarefa ${i + 1}`,
      prazo: '2026-11-02',
      incluida: true,
    }))
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/planos-marketing/': () => json({ count: 0, results: [] }),
      '/api/planos-marketing/situacao/': () => json({ plano_inicial: true, motivo_inicial: null, novo_ciclo: null }),
      '/api/planos-marketing/previa/': () =>
        json({
          angariacao: 4,
          imovel: 7,
          data_base: '2026-11-02',
          responsavel: 1,
          responsavel_nome: 'Consultor Demo',
          ocorrencias,
        }),
      'POST /api/planos-marketing/': () => json(PLANO, 201),
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <ProvedorSessao>
          <MemoryRouter>
            <PlanoBloco angariacao={4} />
          </MemoryRouter>
        </ProvedorSessao>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Criar plano inicial' }))
    const dialogo = within(await screen.findByRole('dialog'))
    expect(await dialogo.findByText(/Vão ser criadas 45 de 45/)).toBeInTheDocument()
    expect(dialogo.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(45)
    fireEvent.click(dialogo.getByLabelText('7. Tarefa 7'))
    expect(dialogo.getByText(/Vão ser criadas 44 de 45/)).toBeInTheDocument()
    fireEvent.click(dialogo.getByRole('button', { name: 'Confirmar e criar o plano' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ angariacao: 4, excluidos: [7] })
  })

  it('novo ciclo após renovação: origem «seleção anterior», destino das pendentes e confirmação', async () => {
    const ocorrencias = Array.from({ length: 45 }, (_, i) => ({
      numero: i + 1,
      semana: Math.min(8, Math.floor(i / 6) + 1),
      designacao: `Tarefa ${i + 1}`,
      prazo: '2026-11-04',
      incluida: i + 1 !== 7,
    }))
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/planos-marketing/': () => json({ count: 1, results: [{ ...PLANO, ativo: true }] }),
      '/api/planos-marketing/situacao/': () =>
        json({
          plano_inicial: false,
          motivo_inicial: 'x',
          novo_ciclo: { renovacao: 9, ciclo: 2, data_inicio: '2026-11-04' },
        }),
      '/api/planos-marketing/previa-ciclo/': (url) =>
        json({
          angariacao: 4,
          renovacao: 9,
          ciclo: 2,
          data_base: '2026-11-04',
          origem: url.searchParams.get('origem'),
          responsavel_nome: 'Consultor Demo',
          anterior: {
            id: 3,
            referencia: 'PMK-000003',
            ciclo: 1,
            pendentes: [{ tarefa: 12, numero: 2, titulo: 'x', prazo: null }],
          },
          ocorrencias:
            url.searchParams.get('origem') === 'anterior'
              ? ocorrencias
              : ocorrencias.map((o) => ({ ...o, incluida: true })),
          origens: [
            { valor: 'catalogo', nome: 'Catálogo-padrão (as 45 marcadas)' },
            { valor: 'anterior', nome: 'Seleção do ciclo anterior' },
          ],
          destinos: [
            { valor: 'manter', nome: 'Manter ativas' },
            { valor: 'encerrar', nome: 'Encerrar como «Não executada — Plano substituído»' },
          ],
        }),
      'POST /api/planos-marketing/novo-ciclo/': () => json({ ...PLANO, id: 5, ciclo: 2 }, 201),
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <ProvedorSessao>
          <MemoryRouter>
            <PlanoBloco angariacao={4} renovacoes={1} />
          </MemoryRouter>
        </ProvedorSessao>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Novo ciclo de marketing' }))
    const dialogo = within(await screen.findByRole('dialog'))
    expect(await dialogo.findByText(/Vão ser criadas 45 de 45/)).toBeInTheDocument()
    fireEvent.change(dialogo.getByLabelText('Origem das tarefas do novo ciclo'), { target: { value: 'anterior' } })
    expect(await dialogo.findByText(/Vão ser criadas 44 de 45/)).toBeInTheDocument()
    const confirmar = dialogo.getByRole('button', { name: 'Confirmar e criar o ciclo' })
    expect(confirmar).toBeDisabled() // falta escolher o destino das pendentes
    fireEvent.change(dialogo.getByLabelText(/Tarefas por fazer do plano anterior \(1\)/), {
      target: { value: 'encerrar' },
    })
    fireEvent.click(confirmar)
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({
      angariacao: 4,
      origem: 'anterior',
      destino: 'encerrar',
      excluidos: [7],
    })
  })
})
