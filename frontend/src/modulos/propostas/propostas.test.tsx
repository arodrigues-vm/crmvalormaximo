import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar'].map((o) => [o, a])) as Record<string, string>

const UTIL = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, propostas: todas('atribuidos'), visitas: todas('atribuidos') },
}

const OPCOES = {
  estados: [
    { id: 1, nome: 'Em negociação', categoria: 'negociacao' },
    { id: 2, nome: 'Aceite', categoria: 'aceite' },
  ],
  papeis: [
    { id: 10, nome: 'Comprador' },
    { id: 11, nome: 'Proprietário' },
  ],
  modos_pagamento: [{ id: 20, nome: 'Financiamento' }],
  sim_nao: [],
  autores: [
    { valor: 'comprador', nome: 'Comprador' },
    { valor: 'proprietario', nome: 'Proprietário' },
  ],
  unidades: [
    { valor: 'percentagem', nome: '% do valor' },
    { valor: 'euros', nome: '€' },
  ],
  pode_criar: true,
}

const PREVIA = {
  visita: 3,
  visita_referencia: 'VIS-000003',
  imovel: 5,
  imovel_descricao: '',
  imovel_localizacao: '',
  imovel_descricao_completa: 'IMO-000005 · T3 · Maia',
  entidade: 7,
  entidade_nome: 'Bruno Comprador',
  agente_comprador: 4,
  agente_comprador_nome: 'Consultor Ensaio',
  agente_imovel: 4,
  agente_imovel_nome: 'Consultor Ensaio',
  valor_sugerido: '250000.00',
  participantes: [
    { entidade: 7, nome: 'Bruno Comprador', papel: 10, quota: null },
    { entidade: 8, nome: 'Ana Proprietária', papel: 11, quota: '100.0000' },
  ],
}

afterEach(() => vi.restoreAllMocks())

describe('Propostas', () => {
  it('«Gerar Proposta» pré-preenche a partir da visita e só grava ao confirmar', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/propostas/opcoes/': () => json(OPCOES),
      'GET /api/propostas/previa/': () => json(PREVIA),
      'POST /api/propostas/': () => json({ campos: {} }, 400),
    })
    desenhar('/propostas/nova?visita=3')
    expect(await screen.findByText(/A proposta só é criada quando carregar em/)).toBeInTheDocument()
    expect(pedidos.some((p) => p.metodo === 'POST')).toBe(false)
    expect(screen.getByLabelText(/^Valor \(€\)/)).toHaveValue('250000')
    fireEvent.change(screen.getByLabelText(/^Valor \(€\)/), { target: { value: '230000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      visita: 3,
      imovel: 5,
      entidade: 7,
      participantes: [
        { entidade: 7, papel: 10, quota: null },
        { entidade: 8, papel: 11, quota: '100' },
      ],
      ronda_inicial: { autor: 'comprador', valor: '230000' },
    })
  })

  it('visita que já tem proposta mostra a ligação em vez de criar outra', async () => {
    simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/propostas/opcoes/': () => json(OPCOES),
      'GET /api/propostas/previa/': () =>
        json({ detail: 'Esta visita já deu origem à proposta PRP-000001.', codigo: 'ja_existe', proposta: 1 }, 409),
    })
    desenhar('/propostas/nova?visita=3')
    expect(await screen.findByRole('link', { name: 'Abrir a proposta' })).toHaveAttribute('href', '/propostas/1')
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })

  it('nova ronda parte da última e alterna quem propõe', async () => {
    const ronda = {
      id: 1,
      numero: 1,
      autor: 'comprador',
      autor_nome: 'Comprador',
      data: '2026-11-20',
      valor: '230000.00',
      sinal_valor: '10.00',
      sinal_unidade: 'percentagem',
      modo_pagamento: 20,
      modo_pagamento_nome: 'Financiamento',
      financiamento: null,
      financiamento_nome: null,
      data_cpcv: null,
      data_escritura: null,
      validade: null,
      condicoes: '',
      criado_em: '2026-11-20T10:00:00Z',
      criado_por_nome: 'Consultor Demo',
    }
    const proposta = {
      id: 9, referencia: 'PRP-000009', entidade: 7, entidade_nome: 'Bruno Comprador', imovel: 5,
      imovel_descricao_completa: 'IMO-000005 · T3 · Maia', estado: 1, estado_nome: 'Em negociação',
      estado_categoria: 'negociacao', valor_atual: '230000.00', ultima_ronda_autor: 'Comprador',
      responsavel_nome: 'Consultor Demo', criado_em: '2026-11-20T10:00:00Z', visita: 3, visita_referencia: 'VIS-000003',
      imovel_descricao: '', imovel_localizacao: '', agente_comprador: 4, agente_comprador_nome: 'Consultor Ensaio',
      agente_imovel: 4, agente_imovel_nome: 'Consultor Ensaio', participantes_detalhe: [], rondas: [ronda],
      responsavel: 1, observacoes: '', atualizado_em: '2026-11-20T10:00:00Z', versao: 1,
      acoes: { editar: true, eliminar: true, transferir: false },
    } // prettier-ignore
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/propostas/opcoes/': () => json(OPCOES),
      'GET /api/propostas/9/': () => json(proposta),
      'POST /api/propostas/9/rondas/': () => json(proposta, 201),
    })
    desenhar('/propostas/9')
    fireEvent.click(await screen.findByRole('button', { name: '+ Nova ronda / contraproposta' }))
    const d = await screen.findByRole('dialog', { hidden: true, name: 'Nova ronda / contraproposta' })
    expect(within(d).getByLabelText('Quem propõe')).toHaveValue('proprietario')
    fireEvent.change(within(d).getByLabelText(/^Valor \(€\)/), { target: { value: '245000' } })
    fireEvent.click(within(d).getByRole('button', { name: 'Registar ronda', hidden: true }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      autor: 'proprietario',
      valor: '245000',
      sinal_valor: '10',
      modo_pagamento: 20,
    })
  })
})
