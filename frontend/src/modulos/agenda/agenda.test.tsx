import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'
import { grelhaMes, inicioSemana, intervalo, somarMeses } from './datas'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar'].map((o) => [o, a])) as Record<string, string>

const U = { ...UTILIZADOR_CONSULTOR, permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, agenda: todas('atribuidos') } }

const OPCOES = {
  tipos: [{ id: 1, nome: 'Reunião' }],
  estados: [
    { id: 10, nome: 'Agendado', categoria: 'agendado' },
    { id: 11, nome: 'Concluído', categoria: 'concluido' },
    { id: 12, nome: 'Cancelado', categoria: 'cancelado' },
  ],
  tipos_interacao: [],
  pessoas: [
    { id: 1, nome: 'Consultor Demo' },
    { id: 2, nome: 'Bruno Equipa' },
  ],
  pode_criar: true,
}

const COMPROMISSO = {
  id: 5,
  referencia: 'AGE-000005',
  titulo: 'Reunião com proprietário',
  tipo: 1,
  tipo_nome: 'Reunião',
  inicio: '2026-11-26T15:00:00+00:00',
  fim: null,
  local: 'Escritório',
  descricao: '',
  estado: 10,
  estado_nome: 'Agendado',
  estado_categoria: 'agendado',
  motivo_estado: '',
  entidade: null,
  entidade_nome: null,
  imovel: null,
  imovel_descricao: null,
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  criado_em: '2026-11-20T10:00:00Z',
  atualizado_em: '2026-11-20T10:00:00Z',
  versao: 1,
  acoes: { editar: true, eliminar: true, transferir: false },
}

afterEach(() => vi.restoreAllMocks())

describe('Datas da Agenda', () => {
  it('semana começa à segunda; o mês cobre semanas completas', () => {
    expect(inicioSemana('2026-11-26')).toBe('2026-11-23')
    expect(inicioSemana('2026-11-29')).toBe('2026-11-23') // domingo
    const g = grelhaMes('2026-11-15')
    expect(g[0]).toBe('2026-10-26')
    expect(g[g.length - 1]).toBe('2026-12-06')
    expect(g.length % 7).toBe(0)
    expect(intervalo('semana', '2026-11-26')).toEqual(['2026-11-23', '2026-11-29'])
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-01')
  })
})

describe('Agenda (D-51)', () => {
  it('mostra os acontecimentos da semana, da própria pessoa, e muda para outra pessoa', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/agenda/compromissos/opcoes/': () => json(OPCOES),
      '/api/agenda/compromissos/avisos/': () => json([]),
      '/api/agenda/compromissos/eventos/': () =>
        json([
          {
            chave: 'visita-3',
            origem: 'visita',
            titulo: 'Visita · Ana Cliente',
            data: '2026-11-26',
            inicio: '2026-11-26T10:00:00+00:00',
            fim: '2026-11-26T11:00:00+00:00',
            dia_inteiro: false,
            estado_nome: 'Agendada',
            estado_categoria: 'agendada',
            caminho: '/visitas/3',
            responsavel: 1,
            responsavel_nome: 'Consultor Demo',
            detalhe: 'Moradia T4',
          },
        ]),
    })
    desenhar('/agenda?data=2026-11-26')
    const ligacao = await screen.findByRole('link', { name: /Visita · Ana Cliente/ })
    expect(ligacao).toHaveAttribute('href', '/visitas/3')
    expect(within(ligacao).getByText('10:00–11:00')).toBeInTheDocument()
    const pedido = pedidos.find((p) => p.url.pathname.endsWith('/eventos/'))!.url.searchParams
    expect([pedido.get('inicio'), pedido.get('fim'), pedido.get('pessoa')]).toEqual(['2026-11-23', '2026-11-29', '1'])
    fireEvent.change(await screen.findByLabelText('Agenda de'), { target: { value: 'todas' } })
    await waitFor(() =>
      expect(
        pedidos
          .filter((p) => p.url.pathname.endsWith('/eventos/'))
          .at(-1)!
          .url.searchParams.has('pessoa'),
      ).toBe(false),
    )
  })

  it('cancelar um compromisso pede o motivo', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/agenda/compromissos/opcoes/': () => json(OPCOES),
      '/api/agenda/compromissos/avisos/': () => json([]),
      'GET /api/agenda/compromissos/5/': () => json(COMPROMISSO),
      'POST /api/agenda/compromissos/5/mudar-estado/': () =>
        json({ ...COMPROMISSO, estado: 12, estado_nome: 'Cancelado', estado_categoria: 'cancelado' }),
    })
    desenhar('/agenda/compromissos/5')
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar compromisso' }))
    const dialogo = within(await screen.findByRole('dialog'))
    fireEvent.change(dialogo.getByLabelText('Motivo'), { target: { value: 'Cliente adiou' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Cancelar compromisso' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ estado: 12, motivo: 'Cliente adiou' })
    expect(await screen.findByRole('button', { name: 'Reabrir' })).toBeInTheDocument()
  })

  it('o sino mostra os avisos e dispensa um', async () => {
    let lista = [
      {
        chave: 'tarefa-4-20261126',
        origem: 'tarefa',
        titulo: 'Ligar ao cliente',
        momento: null,
        caminho: '/pos-venda/4',
      },
    ]
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(U),
      '/api/agenda/compromissos/opcoes/': () => json(OPCOES),
      '/api/agenda/compromissos/eventos/': () => json([]),
      'GET /api/agenda/compromissos/avisos/': () => json(lista),
      'POST /api/agenda/compromissos/avisos/dispensar/': () => {
        lista = []
        return new Response(null, { status: 204 })
      },
    })
    desenhar('/agenda')
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos (1)' }))
    expect(screen.getByText('Ligar ao cliente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso Ligar ao cliente' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ chave: 'tarefa-4-20261126' })
    expect(await screen.findByRole('button', { name: 'Avisos (0)' })).toBeInTheDocument()
  })
})
