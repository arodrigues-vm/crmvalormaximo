import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar'].map((o) => [o, a])) as Record<string, string>

const UTIL = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: {
    ...UTILIZADOR_CONSULTOR.permissoes,
    procuras: todas('atribuidos'),
    oportunidades: todas('atribuidos'),
    imoveis: todas('atribuidos'),
  },
}

const OPCOES_PROC = {
  estados: [{ id: 1, nome: 'Ativa', categoria: 'ativa' }],
  pretende: [
    { valor: 'comprar', nome: 'Comprar' },
    { valor: 'arrendar', nome: 'Arrendar' },
  ],
  urgencias: [],
  tipos_imovel: [{ id: 2, nome: 'Apartamento' }],
  tipologias: [
    { id: 10, nome: 'T2' },
    { id: 11, nome: 'T3' },
  ],
  zonas_comerciais: [],
  zonas_exteriores: [],
  condicoes_fisicas: [],
  tipos_interacao: [],
  importancias: [],
  qualificacoes: [{ valor: 'inicial', nome: 'Inicial' }],
  pode_criar: true,
}

afterEach(() => vi.restoreAllMocks())

describe('Procuras', () => {
  it('formulário mostra o preço máximo e envia a importância dos critérios', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/procuras/opcoes/': () => json(OPCOES_PROC),
      'POST /api/procuras/': () => json({ id: 9 }, 400),
    })
    desenhar('/procuras/nova')
    fireEvent.change(await screen.findByLabelText('Valor de aquisição previsto (€)'), { target: { value: '250000' } })
    fireEvent.change(screen.getByLabelText('Tolerância (%)'), { target: { value: '20' } })
    expect(screen.getByText(/300\s000 €/)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /^Tipologias/ }))
    await waitFor(() => expect(screen.getAllByRole('checkbox', { name: 'T3' }).length).toBe(1))
    fireEvent.click(screen.getByRole('checkbox', { name: 'T3' }))
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Importância: Tipologia' })).getByLabelText('Obrigatório'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    const corpo = pedidos.find((p) => p.metodo === 'POST')!.corpo as Record<string, unknown>
    expect(corpo).toMatchObject({
      orcamento_max: '250000',
      tolerancia_pct: '20',
      tipologias: [11],
      imp_tipologias: 'obrigatorio',
    })
  })

  it('qualificação: prazos em texto e listas configuráveis', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/procuras/opcoes/': () =>
        json({ ...OPCOES_PROC, modos_pagamento: [{ id: 70, nome: 'Pronto pagamento' }], sim_nao: [] }),
      'POST /api/procuras/': () => json({ id: 9 }, 400),
    })
    desenhar('/procuras/nova')
    fireEvent.change(await screen.findByLabelText('Quando iniciou a procura'), { target: { value: 'Há 3 meses' } })
    fireEvent.change(screen.getByLabelText('Modo de pagamento'), { target: { value: '70' } })
    fireEvent.change(screen.getByLabelText('Valor de aquisição previsto (€)'), { target: { value: '200000' } })
    expect(screen.queryByLabelText('Qualificação')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      quando_iniciou: 'Há 3 meses',
      modo_pagamento: 70,
      orcamento_max: '200000',
      financiamento: null,
    })
  })

  it('ficha mostra imóveis compatíveis com a explicação dos critérios', async () => {
    simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/procuras/opcoes/': () => json(OPCOES_PROC),
      'GET /api/procuras/3/': () =>
        json({
          id: 3,
          referencia: 'PRC-000003',
          entidade: 7,
          entidade_nome: 'Bruno Ensaio',
          pretende: 'comprar',
          estado: 1,
          estado_nome: 'Ativa',
          estado_categoria: 'ativa',
          qualificacao: 'inicial',
          urgencia: null,
          motivacao: '',
          flexibilidade: '',
          prazo_compra: null,
          data_inicio: '2026-11-15',
          orcamento_max: '250000.00',
          tolerancia_pct: '20.0',
          teto: '300000.00',
          tipos: [],
          imp_tipos: 'obrigatorio',
          tipologias: [11],
          imp_tipologias: 'obrigatorio',
          concelhos: [],
          freguesias: [],
          zonas_comerciais: [],
          imp_localizacao: 'obrigatorio',
          quartos_min: null,
          imp_quartos: 'preferencial',
          area_min: null,
          imp_area: 'preferencial',
          zonas_exteriores: [],
          imp_zonas_exteriores: 'preferencial',
          exige_elevador: false,
          imp_elevador: 'preferencial',
          estacionamento_min: null,
          imp_estacionamento: 'preferencial',
          condicoes_fisicas: [],
          imp_condicoes: 'preferencial',
          responsavel: 1,
          responsavel_nome: 'Consultor Demo',
          observacoes: '',
          resumo: 'T3',
          nomes: {
            pretende: 'Comprar',
            estado: 'Ativa',
            urgencia: null,
            qualificacao: 'Inicial',
            tipos: [],
            tipologias: ['T3'],
            concelhos: [],
            freguesias: [],
            zonas_comerciais: [],
            zonas_exteriores: [],
            condicoes_fisicas: [],
          },
          criado_em: '2026-11-15T10:00:00Z',
          versao: 1,
          acoes: { editar: true, eliminar: true, transferir: false },
        }),
      'GET /api/procuras/3/correspondencias/': () =>
        json({
          teto: '300000.00',
          resultados: [
            {
              imovel: {
                id: 5,
                referencia: 'IMO-000005',
                descricao: 'Apartamento T3 Ensaio',
                preco: '280000.00',
                fotografia: null,
              },
              criterios: [
                {
                  criterio: 'preco',
                  estado: 'cumpre',
                  obrigatorio: true,
                  detalhe: '280 000 € acima do orçamento, dentro da tolerância',
                },
                { criterio: 'tipologia', estado: 'cumpre', obrigatorio: true, detalhe: 'T3' },
              ],
              obrigatorios_por_confirmar: 0,
              preferencias_cumpridas: 0,
              preferencias_total: 0,
              grupo_preco: 1,
            },
          ],
        }),
      'GET /api/procuras/3/interacoes/': () => json([]),
    })
    desenhar('/procuras/3')
    expect((await screen.findAllByText(/300\s000,00\s€/)).length).toBeGreaterThan(0)
    expect(await screen.findByText('IMO-000005')).toBeInTheDocument()
    expect(screen.getByText('Dentro da tolerância')).toBeInTheDocument()
    expect(screen.getByText(/dentro da tolerância$/)).toBeInTheDocument()
  })
})

describe('Oportunidades', () => {
  it('criar imóvel pede confirmação e abre o imóvel para completar', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/oportunidades/opcoes/': () =>
        json({
          estados: [],
          operacoes: [],
          origens: [],
          tipos_imovel: [],
          tipologias: [],
          tipos_interacao: [],
          qualificacoes: [],
          pode_criar: true,
        }),
      'GET /api/oportunidades/4/': () =>
        json({
          id: 4,
          referencia: 'OPA-000004',
          entidade: 7,
          entidade_nome: 'Ana Ensaio',
          imovel: null,
          imovel_descricao: 'Moradia T3 · Ensaio',
          tipo_imovel: null,
          tipologia: null,
          localidade: 'Ensaio',
          descricao_imovel: '',
          operacao: null,
          operacao_nome: 'Venda',
          estado: null,
          estado_nome: 'Novo contacto',
          estado_categoria: 'aberta',
          qualificacao: 'inicial',
          origem: null,
          motivacao: '',
          preco_pretendido: '320000.00',
          prazo: null,
          angariacao_gerada: null,
          angariacao_gerada_referencia: null,
          responsavel: 1,
          responsavel_nome: 'Consultor Demo',
          observacoes: '',
          nomes: {
            tipo_imovel: 'Moradia',
            tipologia: 'T3',
            operacao: 'Venda',
            estado: 'Novo contacto',
            origem: null,
            qualificacao: 'Inicial',
          },
          criado_em: '2026-11-15T10:00:00Z',
          atualizado_em: '2026-11-15T10:00:00Z',
          versao: 1,
          acoes: { editar: true, eliminar: true, transferir: false },
        }),
      'GET /api/oportunidades/4/interacoes/': () => json([]),
      'POST /api/oportunidades/4/converter/': () =>
        json({
          imovel: 8,
          imovel_referencia: 'IMO-000008',
          imovel_criado: true,
          angariacao: 6,
          angariacao_referencia: 'CMI-000006',
        }),
      'GET /api/angariacoes/6/': () => json({ detail: 'x' }, 404),
      '/api/angariacoes/opcoes/': () =>
        json({ operacoes: [], regimes: [], papeis: [], modalidades: [], modalidades_por_operacao: {} }),
    })
    const { router } = desenhar('/oportunidades/4')
    fireEvent.click(await screen.findByRole('button', { name: 'Criar imóvel' }))
    const d = await screen.findByRole('dialog', { hidden: true, name: 'Criar imóvel' })
    fireEvent.click(within(d).getByRole('button', { name: 'Confirmar', hidden: true }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/imoveis/8/editar'))
    expect(pedidos.find((p) => p.url.pathname.endsWith('/converter/'))!.corpo).toEqual({
      confirmar: true,
      criar_cmi: false,
    })
  })
})

describe('Oportunidades — qualificação', () => {
  it('mostra o valor da proposta só quando teve propostas', async () => {
    simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/oportunidades/opcoes/': () =>
        json({
          estados: [],
          operacoes: [],
          origens: [],
          tipos_imovel: [],
          tipologias: [],
          tipos_interacao: [],
          sim_nao: [
            { id: 1, nome: 'Sim' },
            { id: 2, nome: 'Não' },
          ],
          pode_criar: true,
        }),
    })
    desenhar('/oportunidades/nova')
    const propostas = await screen.findByLabelText('Teve propostas')
    expect(screen.queryByLabelText('Valor da proposta (€)')).not.toBeInTheDocument()
    fireEvent.change(propostas, { target: { value: '1' } })
    expect(screen.getByLabelText('Valor da proposta (€)')).toBeInTheDocument()
    expect(screen.getByLabelText('Prazo para vender')).not.toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Anúncio (site)')).toHaveAttribute('type', 'url')
  })
})
