import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

export type Lado = 'angariacao' | 'venda'

export interface ComissaoResumo {
  id: number
  referencia: string
  transacao: number
  transacao_referencia: string
  transacao_estado: string | null
  imovel_descricao: string
  comprador_nome: string | null
  valor_final: string | null
  origem: 'calculado' | 'manual' | 'excecao'
  lado_angariacao_nosso: boolean
  lado_venda_nosso: boolean
  total_nosso: string | null
  excecao_pendente: boolean
  responsavel_nome: string
  criado_em: string
}

export interface Beneficiario {
  id?: number
  lado: Lado
  utilizador: number
  utilizador_nome?: string
  modo: '' | 'percentagem' | 'deducao'
  percentagem: string | null
  deducao: string | null
  valor?: string | null
}

export interface Excecao {
  id: number
  valor_original: string | null
  valor_proposto: string
  motivo: string
  requerente_nome: string
  criado_em: string
  estado: 'pendente' | 'aprovada' | 'recusada'
  estado_nome: string
  decidido_por_nome: string | null
  decidido_em: string | null
  motivo_decisao: string
}

export interface ResumoLado {
  nosso: boolean
  valor: string | null
  consultores: string | null
  agencia: string | null
}

export interface Comissao extends ComissaoResumo {
  cmi_referencia: string
  cmi_versao: number | null
  modalidade: string
  modalidade_nome: string | null
  taxa_ou_valor: string | null
  base_negocio: string | null
  minimo: string | null
  taxa_iva: string | null
  inclui_iva: boolean | null
  valor_calculado: string | null
  origem_nome: string
  iva: string | null
  total_com_iva: string | null
  pct_angariacao: string
  resumo: { angariacao: ResumoLado; venda: ResumoLado; total_nosso: string | null; total_agencia: string | null }
  operacao_categoria: string | null
  responsavel_imovel_nome: string | null
  responsavel_comprador_nome: string | null
  beneficiarios: Beneficiario[]
  excecoes: Excecao[]
  responsavel: number
  observacoes: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; aprovar?: boolean }
}

export interface OpcoesComissao {
  modos: { valor: string; nome: string }[]
  lados: { valor: string; nome: string }[]
  consultores: { id: number; nome: string }[]
  pode_criar: boolean
}

const BASE = '/api/comissoes/'

export const comissoesApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: ComissaoResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Comissao>(`${BASE}${id}/`),
  apurar: (transacao: number) => pedido<Comissao>(BASE, { json: { transacao } }),
  atualizar: (id: number, dados: unknown) => pedido<Comissao>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesComissao>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  recalcular: (id: number) => pedido<Comissao>(`${BASE}${id}/recalcular/`, { method: 'POST' }),
  pedirExcecao: (id: number, dados: unknown) => pedido<Comissao>(`${BASE}${id}/excecoes/`, { json: dados }),
  decidirExcecao: (id: number, excecao: number, dados: unknown) =>
    pedido<Comissao>(`${BASE}${id}/excecoes/${excecao}/decidir/`, { json: dados }),
}

export const NOMES_LADO: Record<Lado, string> = { angariacao: 'Angariação', venda: 'Venda' }

export const NOMES_CAMPOS_COMISSAO: Record<string, string> = {
  valor_calculado: 'Comissão calculada',
  valor_final: 'Comissão total',
  origem: 'Origem do valor',
  pct_angariacao: '% do lado da angariação',
  lado_angariacao_nosso: 'Lado da angariação é nosso',
  lado_venda_nosso: 'Lado da venda é nosso',
  responsavel: 'Responsável',
  observacoes: 'Observações',
}
