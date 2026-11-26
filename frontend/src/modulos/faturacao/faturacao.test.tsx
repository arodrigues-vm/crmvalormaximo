import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar', 'aprovar'].map((o) => [o, a])) as Record<
    string,
    string
  >

const ADMIN = {
  ...UTILIZADOR_CONSULTOR,
  id: 99,
  nome: 'Administrador Ensaio',
  permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, faturacao: todas('todos') },
}

const DOCUMENTO = {
  id: 3,
  referencia: 'DOC-000003',
  comissao: 4,
  comissao_referencia: 'COM-000004',
  transacao_referencia: 'TRA-000009',
  consultor: 5,
  consultor_nome: 'Ana Ensaio',
  tipo: 80,
  tipo_nome: 'Fatura',
  tipo_categoria: 'fatura',
  serie: 'A',
  numero: '12',
  data_emissao: '2026-11-20',
  base: '1250.00',
  iva: '287.50',
  retencao: '250.00',
  total: '1537.50',
  saldo: { a_pagar: '1287.50', pago: '1000.00', em_aberto: '287.50', estornos_pendentes: '0.00' },
  criado_em: '2026-11-20T10:00:00Z',
  prestacao: null,
  prestacao_descricao: null,
  taxa_iva: '23.00',
  documento_original: null,
  documento_original_referencia: null,
  movimentos: [
    {
      id: 21,
      tipo: 'pagamento',
      tipo_nome: 'Pagamento',
      estado: 'efetivo',
      estado_nome: 'Efetivo',
      data_efetiva: '2026-11-21',
      registado_em: '2026-11-21T10:00:00Z',
      valor: '1000.00',
      meio: null,
      meio_nome: 'Transferência bancária',
      referencia_pagamento: '',
      estorno_de: null,
      motivo: '',
      criado_por_nome: 'Administrador Ensaio',
      decidido_por_nome: null,
      decidido_em: null,
      motivo_decisao: '',
      estornavel: '1000.00',
    },
  ],
  responsavel: 5,
  observacoes: '',
  atualizado_em: '2026-11-21T10:00:00Z',
  versao: 2,
  acoes: { editar: true, eliminar: true, aprovar: true },
}

afterEach(() => vi.restoreAllMocks())

describe('Faturação dos consultores (D-49)', () => {
  it('a ficha mostra o que falta pagar e regista um pagamento parcial', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/documentos-consultor/3/': () => json(DOCUMENTO),
      '/api/documentos-consultor/opcoes/': () =>
        json({ tipos: [], meios: [{ id: 90, nome: 'Transferência bancária' }], pode_criar: true }),
      'POST /api/documentos-consultor/3/pagamento/': () => json(DOCUMENTO, 201),
    })
    desenhar('/faturacao/documentos/3')
    expect(await screen.findByText(/^287,50\s€$/, { selector: 'strong' })).toBeInTheDocument() // em falta
    expect(screen.getByRole('button', { name: 'Estornar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento' }))
    const dialogo = within(await screen.findByRole('dialog'))
    expect(dialogo.getByLabelText('Valor (€)')).toHaveValue('287.5')
    fireEvent.change(dialogo.getByLabelText('Valor (€)'), { target: { value: '100,5' } })
    fireEvent.change(dialogo.getByLabelText('Meio de pagamento'), { target: { value: '90' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Registar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({ valor: '100.5', meio: 90 })
  })

  it('pedir estorno envia o pagamento, o valor e o motivo', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/documentos-consultor/3/': () => json(DOCUMENTO),
      'POST /api/documentos-consultor/3/estorno/': () => json(DOCUMENTO, 201),
    })
    desenhar('/faturacao/documentos/3')
    fireEvent.click(await screen.findByRole('button', { name: 'Estornar' }))
    const dialogo = within(await screen.findByRole('dialog'))
    fireEvent.change(dialogo.getByLabelText('Valor a estornar (€)'), { target: { value: '300' } })
    fireEvent.change(dialogo.getByLabelText('Motivo'), { target: { value: 'Pago a mais' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Pedir estorno' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      pagamento: 21,
      valor: '300',
      motivo: 'Pago a mais',
    })
  })
})
