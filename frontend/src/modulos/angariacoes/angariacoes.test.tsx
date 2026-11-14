import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar', 'aprovar'].map((o) => [o, a])) as Record<
    string,
    string
  >

const OPCOES = {
  operacoes: [
    { id: 40, nome: 'Venda', categoria: 'venda' },
    { id: 41, nome: 'Arrendamento', categoria: 'arrendamento' },
  ],
  regimes: [{ id: 70, nome: 'Exclusivo', categoria: 'exclusivo' }],
  papeis: [{ id: 80, nome: 'Proprietário' }],
  modalidades: [
    { valor: 'percentagem', nome: 'Percentagem sobre o valor do negócio' },
    { valor: 'valor_fixo', nome: 'Valor fixo' },
    { valor: 'numero_rendas', nome: 'Número de rendas' },
    { valor: 'percentagem_base', nome: 'Percentagem sobre base contratual' },
  ],
  modalidades_por_operacao: {
    venda: ['percentagem', 'valor_fixo'],
    arrendamento: ['numero_rendas', 'percentagem_base', 'valor_fixo'],
  },
  formas_renovacao: [{ valor: 'documento', nome: 'Formalizada por documento' }],
  situacoes: [],
  estados: {},
  alertas_dias: [120, 60, 30],
  pode_criar: true,
  pode_transferir: false,
  pode_restaurar: false,
}

const CMI = {
  id: 3,
  referencia: 'CMI-000003',
  numero_contrato: '12/2026',
  imovel: 5,
  imovel_referencia: 'IMO-000005',
  imovel_descricao: 'Apartamento T2 Ensaio',
  operacao: 40,
  regime: 70,
  data_assinatura: '2026-06-01',
  data_inicio: '2026-06-01',
  prazo_meses: 6,
  data_fim: '2026-11-30',
  data_fim_vigente: '2026-11-30',
  situacao: 'em_curso',
  situacao_motivo: '',
  estado: 'ativa',
  estado_nome: 'Ativa',
  alerta: { dias: 16, limiar: 30 },
  assinado: true,
  modalidade_remuneracao: 'percentagem',
  valor_remuneracao: '5.0000',
  base_contratual: '',
  valor_minimo_remuneracao: null,
  taxa_iva: '23.00',
  remuneracao_inclui_iva: false,
  condicoes_pagamento: '',
  intervenientes_detalhe: [
    {
      entidade: 7,
      acessivel: true,
      nome_completo: 'Ana Ensaio',
      referencia: 'ENT-000007',
      papel: 80,
      papel_nome: 'Proprietário',
      quota: '100.0000',
    },
  ],
  renovacoes: [],
  correcoes: [],
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  observacoes: '',
  nomes: {
    operacao: 'Venda',
    operacao_categoria: 'venda',
    regime: 'Exclusivo',
    regime_categoria: 'exclusivo',
    modalidade: 'Percentagem sobre o valor do negócio',
    situacao: 'Em curso',
  },
  criado_em: '2026-06-01T10:00:00Z',
  atualizado_em: '2026-06-01T10:00:00Z',
  versao: 2,
  acoes: { editar: true, eliminar: true, transferir: false },
}

const base = {
  '/api/auth/eu/': () =>
    json({
      ...UTILIZADOR_CONSULTOR,
      permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, angariacoes: todas('atribuidos') },
    }),
  '/api/angariacoes/opcoes/': () => json(OPCOES),
  'GET /api/angariacoes/3/': () => json(CMI),
  'GET /api/angariacoes/3/ligacoes/': () => json([]),
  'GET /api/listas/': () => json([]),
}

afterEach(() => vi.restoreAllMocks())

describe('Angariações', () => {
  it('ficha mostra aviso de expiração, ciclos e remuneração', async () => {
    simularApi(base)
    desenhar('/angariacoes/3')
    expect(await screen.findByText('Termina dentro de 16 dias')).toBeInTheDocument()
    expect(screen.getByText('Ciclo 1 — contrato inicial')).toBeInTheDocument()
    expect(screen.getByText(/5 % do valor do negócio/)).toBeInTheDocument()
  })

  it('renovação propõe o dia seguinte ao fim e envia o pedido', async () => {
    const pedidos = simularApi({
      ...base,
      'POST /api/angariacoes/3/renovar/': () => json({ ...CMI, versao: 3 }, 201),
    })
    desenhar('/angariacoes/3')
    fireEvent.click(await screen.findByRole('button', { name: 'Registar renovação' }))
    const dialogo = await screen.findByRole('dialog', { hidden: true, name: 'Registar renovação' })
    expect(within(dialogo).getByLabelText('Início da renovação')).toHaveValue('2026-12-01')
    expect(within(dialogo).getByLabelText('Prazo (meses)')).toHaveValue('6')
    fireEvent.change(within(dialogo).getByLabelText('Forma'), { target: { value: 'documento' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registar renovação', hidden: true }))
    await waitFor(() => expect(pedidos.some((p) => p.url.pathname.endsWith('/renovar/'))).toBe(true))
    expect(pedidos.find((p) => p.url.pathname.endsWith('/renovar/'))!.corpo).toEqual({
      forma: 'documento',
      data_inicio: '2026-12-01',
      prazo_meses: 6,
      observacoes: '',
    })
  })

  it('CMI assinado: edição não mostra datas e não as envia', async () => {
    const pedidos = simularApi({ ...base, 'PATCH /api/angariacoes/3/': () => json(CMI) })
    desenhar('/angariacoes/3/editar')
    expect(await screen.findByText(/só podem ser alterados por/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Data de início')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('N.º do contrato'), { target: { value: '13/2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(true))
    const corpo = pedidos.find((p) => p.metodo === 'PATCH')!.corpo as Record<string, unknown>
    expect(corpo).not.toHaveProperty('data_inicio')
    expect(corpo.versao).toBe(2)
  })

  it('modalidades de remuneração dependem da operação', async () => {
    simularApi({ ...base, 'GET /api/angariacoes/': () => json({ count: 0, results: [] }) })
    desenhar('/angariacoes/nova')
    const operacao = await screen.findByLabelText('Tipo (operação)')
    await waitFor(() => expect(operacao.querySelectorAll('option').length).toBe(3))
    fireEvent.change(operacao, { target: { value: '41' } })
    const nomes = [...screen.getByLabelText('Modalidade').querySelectorAll('option')].map((o) => o.textContent)
    expect(nomes).toEqual(['—', 'Valor fixo', 'Número de rendas', 'Percentagem sobre base contratual'])
  })
})
