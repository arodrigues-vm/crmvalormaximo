import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }

export interface Saldo {
  a_pagar: string
  pago: string
  em_aberto: string
  estornos_pendentes: string
}

export interface DocumentoResumo {
  id: number
  referencia: string
  comissao: number
  comissao_referencia: string
  transacao_referencia: string
  consultor: number
  consultor_nome: string
  tipo: number
  tipo_nome: string | null
  tipo_categoria: string | null
  serie: string
  numero: string
  data_emissao: string
  base: string
  iva: string
  retencao: string
  total: string
  saldo: Saldo
  criado_em: string
}

export interface Movimento {
  id: number
  tipo: 'pagamento' | 'estorno'
  tipo_nome: string
  estado: 'efetivo' | 'pendente' | 'recusado'
  estado_nome: string
  data_efetiva: string
  registado_em: string
  valor: string
  meio: number | null
  meio_nome: string | null
  referencia_pagamento: string
  estorno_de: number | null
  motivo: string
  criado_por_nome: string
  decidido_por_nome: string | null
  decidido_em: string | null
  motivo_decisao: string
  estornavel: string | null
}

export interface Documento extends DocumentoResumo {
  prestacao: number | null
  prestacao_descricao: string | null
  taxa_iva: string | null
  documento_original: number | null
  documento_original_referencia: string | null
  movimentos: Movimento[]
  responsavel: number
  observacoes: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; aprovar?: boolean }
}

export interface OpcoesDocumento {
  tipos: Opcao[]
  meios: Opcao[]
  pode_criar: boolean
}

const BASE = '/api/documentos-consultor/'

export const documentosApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: DocumentoResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Documento>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Documento>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Documento>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesDocumento>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  pagamento: (id: number, dados: unknown) => pedido<Documento>(`${BASE}${id}/pagamento/`, { json: dados }),
  estorno: (id: number, dados: unknown) => pedido<Documento>(`${BASE}${id}/estorno/`, { json: dados }),
  decidirEstorno: (id: number, movimento: number, dados: unknown) =>
    pedido<Documento>(`${BASE}${id}/estornos/${movimento}/decidir/`, { json: dados }),
}

export const NOMES_CAMPOS_DOCUMENTO: Record<string, string> = {
  comissao: 'Comissão',
  consultor: 'Consultor',
  prestacao: 'Prestação',
  tipo: 'Tipo',
  serie: 'Série',
  numero: 'Número',
  data_emissao: 'Data de emissão',
  base: 'Base',
  taxa_iva: 'Taxa de IVA',
  iva: 'IVA',
  retencao: 'Retenção na fonte',
  total: 'Total',
  documento_original: 'Documento retificado',
  observacoes: 'Observações',
}
