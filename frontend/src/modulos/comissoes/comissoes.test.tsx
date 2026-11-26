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
  permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, faturacao: todas('todos'), transacoes: todas('todos') },
}

const COMISSAO = {
  id: 4,
  referencia: 'COM-000004',
  transacao: 9,
  transacao_referencia: 'TRA-000009',
  transacao_estado: 'Concluída',
  imovel_descricao: 'IMO-000005 · Apartamento T2 · Maia',
  comprador_nome: 'Bruno Ensaio',
  valor_final: '10000.00',
  origem: 'calculado',
  origem_nome: 'Calculado a partir do CMI',
  lado_angariacao_nosso: true,
  lado_venda_nosso: true,
  total_nosso: '10000.00',
  excecao_pendente: true,
  responsavel_nome: 'Ana Ensaio',
  criado_em: '2026-11-26T10:00:00Z',
  cmi_referencia: 'CMI-000030',
  cmi_versao: 3,
  modalidade: 'percentagem',
  modalidade_nome: 'Percentagem sobre o valor do negócio',
  taxa_ou_valor: '5.0000',
  base_negocio: '200000.00',
  minimo: null,
  taxa_iva: '23.00',
  inclui_iva: false,
  valor_calculado: '10000.00',
  iva: '2300.00',
  total_com_iva: '12300.00',
  pct_angariacao: '50.00',
  resumo: {
    angariacao: { nosso: true, valor: '5000.00', consultores: '2500.00', agencia: '2500.00' },
    venda: { nosso: true, valor: '5000.00', consultores: '4550.00', agencia: '450.00' },
    total_nosso: '10000.00',
    total_agencia: '2950.00',
  },
  operacao_categoria: 'venda',
  responsavel_imovel_nome: 'Ana Ensaio',
  responsavel_comprador_nome: 'Rui Ensaio',
  beneficiarios: [
    {
      id: 1,
      lado: 'angariacao',
      utilizador: 5,
      utilizador_nome: 'Ana Ensaio',
      modo: 'percentagem',
      percentagem: '50.00',
      deducao: null,
      valor: '2500.00',
    },
    {
      id: 2,
      lado: 'venda',
      utilizador: 6,
      utilizador_nome: 'Rui Ensaio',
      modo: 'deducao',
      percentagem: null,
      deducao: '450.00',
      valor: '4550.00',
    },
  ],
  excecoes: [
    {
      id: 7,
      valor_original: '10000.00',
      valor_proposto: '9000.00',
      motivo: 'Desconto acordado',
      requerente_nome: 'Ana Ensaio',
      criado_em: '2026-11-26T11:00:00Z',
      estado: 'pendente',
      estado_nome: 'Pendente',
      decidido_por_nome: null,
      decidido_em: null,
      motivo_decisao: '',
    },
  ],
  responsavel: 5,
  observacoes: '',
  atualizado_em: '2026-11-26T11:00:00Z',
  versao: 2,
  acoes: { editar: true, eliminar: true, aprovar: true },
}

afterEach(() => vi.restoreAllMocks())

describe('Comissões (D-48)', () => {
  it('a ficha mostra o cálculo, a repartição por lados e deixa decidir a exceção pendente', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/comissoes/4/': () => json(COMISSAO),
      'POST /api/comissoes/4/excecoes/7/decidir/': () =>
        json({
          ...COMISSAO,
          valor_final: '9000.00',
          origem: 'excecao',
          excecoes: [{ ...COMISSAO.excecoes[0], estado: 'aprovada', estado_nome: 'Aprovada' }],
        }),
    })
    desenhar('/faturacao/comissoes/4')
    expect(await screen.findByText(/^2950,00\s€$/)).toBeInTheDocument() // fica para a agência
    expect(screen.getByText(/^4550,00\s€$/, { selector: 'strong' })).toBeInTheDocument() // Rui: 5.000 − 450
    expect(screen.getByText(/^12\s300,00\s€$/)).toBeInTheDocument() // total com IVA
    // Com uma exceção pendente não se pede outra nem se recalcula.
    expect(screen.queryByRole('button', { name: 'Pedir exceção ao valor' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Decidir' }))
    const dialogo = within(await screen.findByRole('dialog'))
    fireEvent.click(dialogo.getByRole('button', { name: 'Aprovar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ aprovar: true, motivo: '' })
  })

  it('a edição envia a repartição e os consultores (o valor calculado não se edita)', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/comissoes/4/': () => json({ ...COMISSAO, excecoes: [], excecao_pendente: false }),
      '/api/comissoes/opcoes/': () =>
        json({
          modos: [
            { valor: 'percentagem', nome: 'Percentagem do lado' },
            { valor: 'deducao', nome: 'Lado menos um valor fixo da agência' },
          ],
          lados: [],
          consultores: [
            { id: 5, nome: 'Ana Ensaio' },
            { id: 6, nome: 'Rui Ensaio' },
          ],
          pode_criar: true,
        }),
      '/api/equipa/responsaveis/': () => json([]),
      'PATCH /api/comissoes/4/': () => json(COMISSAO),
    })
    desenhar('/faturacao/comissoes/4/editar')
    expect(await screen.findByLabelText('Comissão total (sem IVA)')).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^% do lado da angariação/), { target: { value: '40' } })
    expect(screen.getByText('O lado da venda fica com 60 %.')).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText('% do lado')[0], { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(true))
    const corpo = pedidos.find((p) => p.metodo === 'PATCH')!.corpo as Record<string, unknown>
    expect(corpo).toMatchObject({ pct_angariacao: '40', versao: 2 })
    expect(corpo).not.toHaveProperty('valor_final')
    expect(corpo.beneficiarios).toEqual([
      { lado: 'angariacao', utilizador: 5, modo: 'percentagem', percentagem: '45', deducao: null },
      { lado: 'venda', utilizador: 6, modo: 'deducao', percentagem: null, deducao: '450' },
    ])
  })
})
