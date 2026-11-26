import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar'].map((o) => [o, a])) as Record<string, string>

const UTIL = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, transacoes: todas('atribuidos'), propostas: todas('atribuidos') },
}

const OPCOES = {
  estados: [
    { id: 1, nome: 'Em preparação', categoria: 'preparacao' },
    { id: 2, nome: 'CPCV assinado', categoria: 'cpcv' },
    { id: 3, nome: 'Escritura marcada', categoria: 'escritura' },
    { id: 4, nome: 'Concluída', categoria: 'concluida' },
    { id: 5, nome: 'Cancelada', categoria: 'cancelada' },
  ],
  operacoes: [
    { id: 40, nome: 'Venda', categoria: 'venda' },
    { id: 41, nome: 'Arrendamento', categoria: 'arrendamento' },
  ],
  papeis: [
    { id: 10, nome: 'Comprador' },
    { id: 11, nome: 'Proprietário' },
  ],
  unidades: [
    { valor: 'percentagem', nome: '% do valor' },
    { valor: 'euros', nome: '€' },
  ],
  tipos_interacao: [],
  pode_criar: true,
}

const PREVIA = {
  proposta: 7,
  proposta_referencia: 'PRP-000007',
  imovel: 5,
  imovel_descricao_completa: 'IMO-000005 · Apartamento T2 · Maia',
  entidade: 3,
  entidade_nome: 'Bruno Ensaio',
  responsavel_imovel_nome: 'Consultor Demo',
  responsavel_comprador_nome: 'Consultor Demo',
  cmis: [
    { id: 30, descricao: 'CMI-000030 · Em curso', em_curso: true, operacao: 40 },
    { id: 31, descricao: 'CMI-000031 · Concluída', em_curso: false, operacao: 40 },
  ],
  cmi_sugerido: null,
  operacao: 40,
  valor: '235000.00',
  sinal_valor: '10.00',
  sinal_unidade: 'percentagem',
  data_cpcv_prevista: '2026-12-15',
  data_escritura_prevista: '2027-02-15',
  participantes: [
    { entidade: 3, nome: 'Bruno Ensaio', papel: 10, quota: null },
    { entidade: 4, nome: 'Ana Ensaio', papel: 11, quota: '100.0000' },
  ],
}

const TRANSACAO = {
  id: 9,
  referencia: 'TRA-000009',
  proposta: 7,
  proposta_referencia: 'PRP-000007',
  imovel: 5,
  imovel_descricao: '',
  imovel_localizacao: '',
  imovel_descricao_completa: 'IMO-000005 · Apartamento T2 · Maia',
  entidade: 3,
  entidade_nome: 'Bruno Ensaio',
  angariacao: 30,
  angariacao_descricao: 'CMI-000030 · Em curso',
  operacao: 40,
  operacao_nome: 'Venda',
  operacao_categoria: 'venda',
  estado: 2,
  estado_nome: 'CPCV assinado',
  estado_categoria: 'cpcv',
  motivo_estado: '',
  valor: '235000.00',
  sinal_valor: '10.00',
  sinal_unidade: 'percentagem',
  data_cpcv_prevista: '2026-12-15',
  data_cpcv: '2026-11-20',
  data_escritura_prevista: '2027-02-15',
  data_escritura: null,
  responsavel_imovel_nome: 'Consultor Demo',
  responsavel_comprador_nome: 'Consultor Demo',
  participantes_detalhe: [
    { entidade: 3, acessivel: true, nome: 'Bruno Ensaio', papel: 10, papel_nome: 'Comprador', quota: null },
    {
      entidade: 4,
      acessivel: false,
      nome: 'Entidade a que não tem acesso',
      papel: 11,
      papel_nome: 'Proprietário',
      quota: '100.0000',
    },
  ],
  efeitos_aplicados: [],
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  observacoes: '',
  criado_em: '2026-11-20T10:00:00Z',
  atualizado_em: '2026-11-20T10:00:00Z',
  versao: 2,
  acoes: { editar: true, eliminar: true, transferir: false },
}

afterEach(() => vi.restoreAllMocks())

describe('Transações (D-47)', () => {
  it('«Gerar Transação» exige a escolha expressa do CMI e envia os dados pré-preenchidos', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/transacoes/opcoes/': () => json(OPCOES),
      '/api/transacoes/previa/': () => json(PREVIA),
      'POST /api/transacoes/': () => json({ campos: {} }, 400),
    })
    desenhar('/transacoes/nova?proposta=7')
    expect(await screen.findByText(/A transação só é criada quando carregar em/)).toBeInTheDocument()
    const cmi = screen.getByLabelText(/^CMI/)
    expect(cmi).toHaveValue('') // sem CMI sugerido: a escolha é do utilizador
    expect(screen.getByLabelText(/^Valor acordado/)).toHaveValue('235000')
    fireEvent.change(cmi, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      proposta: 7,
      angariacao: 30,
      operacao: 40,
      valor: '235000',
      sinal_valor: '10',
      sinal_unidade: 'percentagem',
      data_cpcv_prevista: '2026-12-15',
      participantes: [
        { entidade: 3, papel: 10, quota: null },
        { entidade: 4, papel: 11, quota: '100' },
      ],
    })
  })

  it('proposta que já gerou transação mostra a ligação em vez de duplicar', async () => {
    simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/transacoes/previa/': () =>
        json({ detail: 'Esta proposta já deu origem à transação TRA-000009.', codigo: 'ja_existe', transacao: 9 }, 409),
    })
    desenhar('/transacoes/nova?proposta=7')
    expect(await screen.findByRole('link', { name: 'Abrir a transação' })).toHaveAttribute('href', '/transacoes/9')
  })

  it('mudar estado mostra as alterações propostas e envia só as marcadas', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/transacoes/opcoes/': () => json(OPCOES),
      'GET /api/transacoes/9/': () => json(TRANSACAO),
      'GET /api/transacoes/9/efeitos/': () =>
        json([
          {
            chave: 'imovel_estado',
            descricao: 'Imóvel IMO-000005: passa a «Vendido».',
            antes: 'Reservado',
            depois: 'Vendido',
          },
          {
            chave: 'cmi_concluir',
            descricao: 'CMI CMI-000030: passa a «Concluída».',
            antes: 'Em curso',
            depois: 'Concluída',
          },
        ]),
      'POST /api/transacoes/9/mudar-estado/': () => json({ ...TRANSACAO, estado: 4, estado_nome: 'Concluída' }),
      'GET /api/listas/': () => json([]),
      'GET /api/transacoes/9/ligacoes/': () => json([]),
    })
    desenhar('/transacoes/9')
    expect(await screen.findByText('Entidade a que não tem acesso')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mudar estado' }))
    const dialogo = within(await screen.findByRole('dialog'))
    fireEvent.change(dialogo.getByLabelText('Novo estado'), { target: { value: '4' } })
    fireEvent.change(dialogo.getByLabelText('Data da escritura'), { target: { value: '2026-11-25' } })
    const cmi = await dialogo.findByLabelText(/CMI CMI-000030/)
    expect(cmi).toBeChecked()
    fireEvent.click(cmi) // o utilizador não quer concluir o CMI
    fireEvent.click(dialogo.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({
      estado: 4,
      motivo: '',
      efeitos: ['imovel_estado'],
      data_escritura: '2026-11-25',
    })
  })
})
