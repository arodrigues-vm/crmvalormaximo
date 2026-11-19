import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar'].map((o) => [o, a])) as Record<string, string>

const OPCOES = {
  tipos: [{ id: 1, nome: 'Apartamento' }],
  tipologias: [{ id: 10, nome: 'T2' }],
  estados_comercializacao: [{ id: 20, nome: 'Disponível' }],
  condicoes_fisicas: [],
  zonas_comerciais: [],
  certificados_energeticos: [],
  zonas_exteriores: [{ id: 30, nome: 'Varanda' }],
  quantidades: [
    { id: 60, nome: 'Não' },
    { id: 61, nome: '1' },
  ],
  operacoes: [
    { id: 40, nome: 'Venda', categoria: 'venda' },
    { id: 41, nome: 'Arrendamento', categoria: 'arrendamento' },
  ],
  status: [
    { id: 50, nome: 'Ativo', categoria: 'ativo' },
    { id: 51, nome: 'Inativo', categoria: 'inativo' },
    { id: 52, nome: 'Arquivado', categoria: 'arquivado' },
  ],
  pode_criar: true,
  pode_transferir: false,
  pode_restaurar: false,
}

const IMOVEL = {
  id: 5,
  referencia: 'IMO-000005',
  tipo: 1,
  tipologia: 10,
  operacao: 40,
  estado_comercializacao: 20,
  status: 50,
  tem_fotografia: false,
  condicao_fisica: null,
  preco: '250000.00',
  rua: '',
  numero_policia: '',
  complemento: '',
  codigo_postal: '',
  localidade: 'Localidade Ensaio',
  freguesia: null,
  localizacao: null,
  zona_comercial: null,
  localizacao_descritiva: '',
  area_bruta_privativa: '85.50',
  area_bruta_dependente: null,
  area_util: null,
  area_terreno: null,
  quartos: 2,
  casas_banho: 1,
  ano_construcao: null,
  piso: '',
  elevador: null,
  lugares_estacionamento: null,
  certificado_energetico: null,
  zonas_exteriores: [30],
  descricao: '',
  proprietarios_detalhe: [
    { entidade: 7, acessivel: true, nome_completo: 'Ana Ensaio', referencia: 'ENT-000007', quota: '50.0000' },
    { entidade: 9, acessivel: false, nome_completo: null, referencia: null, quota: '50.0000' },
  ],
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  observacoes: '',
  nomes: {
    tipo: 'Apartamento',
    tipologia: 'T2',
    estado_comercializacao: 'Disponível',
    condicao_fisica: null,
    zona_comercial: null,
    certificado_energetico: null,
    zonas_exteriores: ['Varanda'],
    operacao: 'Venda',
    operacao_categoria: 'venda',
    status: 'Ativo',
    status_categoria: 'ativo',
  },
  criado_em: '2026-11-14T10:00:00Z',
  atualizado_em: '2026-11-14T10:00:00Z',
  versao: 3,
  acoes: { editar: true, eliminar: true, transferir: false },
}

const base = {
  '/api/auth/eu/': () =>
    json({ ...UTILIZADOR_CONSULTOR, permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, imoveis: todas('atribuidos') } }),
  '/api/imoveis/opcoes/': () => json(OPCOES),
  '/api/localizacao/distritos/': () => json([]),
  'GET /api/imoveis/5/': () => json(IMOVEL),
  'GET /api/imoveis/5/ligacoes/': () =>
    json([{ id: 1, tipo: 60, tipo_nome: 'Fotografias', titulo: 'Fotos', url: 'https://onedrive.live.com/x' }]),
  'GET /api/listas/': () => json([{ chave: 'tipos_ligacao', valores: [{ id: 60, nome: 'Fotografias', ativo: true }] }]),
}

afterEach(() => vi.restoreAllMocks())

describe('Imóveis', () => {
  it('ficha mostra preço em euros, áreas e proprietários sem revelar os inacessíveis', async () => {
    simularApi(base)
    desenhar('/imoveis/5')
    expect(await screen.findByRole('heading', { name: /Apartamento T2 · Localidade Ensaio/ })).toBeInTheDocument()
    expect(screen.getByText(/250\s000,00\s€/)).toBeInTheDocument()
    expect(screen.getByText('85,5 m²')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ana Ensaio/ })).toHaveAttribute('href', '/entidades/7')
    expect(screen.getByText('Entidade a que não tem acesso')).toBeInTheDocument()
    expect(screen.getByText('Sem fotografia')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: /Fotos/ })
    expect(link).toHaveAttribute('href', 'https://onedrive.live.com/x')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('edição envia proprietários (incluindo os inacessíveis) e versão; mostra a soma das quotas', async () => {
    const pedidos = simularApi({ ...base, 'PATCH /api/imoveis/5/': () => json({ ...IMOVEL, versao: 4 }) })
    desenhar('/imoveis/5/editar')
    const quotas = await screen.findAllByLabelText('Quota (%)')
    expect(quotas[1]).toBeDisabled()
    fireEvent.change(quotas[0], { target: { value: '60' } })
    expect(screen.getByText(/Soma das quotas indicadas: 110 %/)).toBeInTheDocument()
    fireEvent.change(quotas[0], { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Valor (€)'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Elevadores'), { target: { value: '61' } })
    fireEvent.change(screen.getByLabelText('Área de construção (m²)'), { target: { value: '120,5' } })
    fireEvent.change(screen.getByLabelText('Suites'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(true))
    const corpo = pedidos.find((p) => p.metodo === 'PATCH')!.corpo as Record<string, unknown>
    expect(corpo.versao).toBe(3)
    expect(corpo.operacao).toBe(40)
    expect(corpo.status).toBe(50)
    expect(corpo.preco).toBeNull()
    expect(corpo).toMatchObject({ elevadores: 61, area_construcao: '120.5', suites: 1, garagem: null })
    expect(corpo).not.toHaveProperty('elevador')
    expect(corpo.proprietarios).toEqual([
      { entidade: 7, quota: '50' },
      { entidade: 9, quota: '50' },
    ])
  })
})
