import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }

export interface Ronda {
  id: number
  numero: number
  autor: 'comprador' | 'proprietario'
  autor_nome: string
  data: string
  valor: string
  sinal_valor: string | null
  sinal_unidade: '' | 'percentagem' | 'euros'
  modo_pagamento: number | null
  modo_pagamento_nome: string | null
  financiamento: number | null
  financiamento_nome: string | null
  data_cpcv: string | null
  data_escritura: string | null
  validade: string | null
  condicoes: string
  criado_em: string
  criado_por_nome: string | null
}

export interface PropostaResumo {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string | null
  imovel: number | null
  imovel_descricao_completa: string
  estado_nome: string | null
  estado_categoria: string | null
  valor_atual: string | null
  ultima_ronda_autor: string | null
  responsavel_nome: string
  criado_em: string
}

export interface ParticipanteDetalhe {
  entidade: number
  acessivel: boolean
  nome: string
  papel: number | null
  papel_nome: string | null
  quota: string | null
}

export interface Proposta extends PropostaResumo {
  visita: number | null
  visita_referencia: string | null
  imovel_descricao: string
  imovel_localizacao: string
  agente_comprador: number | null
  agente_comprador_nome: string | null
  agente_imovel: number | null
  agente_imovel_nome: string | null
  estado: number | null
  participantes_detalhe: ParticipanteDetalhe[]
  rondas: Ronda[]
  responsavel: number
  observacoes: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface Previa {
  visita: number
  visita_referencia: string
  imovel: number | null
  imovel_descricao: string
  imovel_localizacao: string
  imovel_descricao_completa: string
  entidade: number
  entidade_nome: string
  agente_comprador: number | null
  agente_comprador_nome: string | null
  agente_imovel: number | null
  agente_imovel_nome: string | null
  valor_sugerido: string | null
  participantes: { entidade: number; nome: string; papel: number | null; quota: string | null }[]
}

export interface OpcoesProposta {
  estados: Opcao[]
  papeis: Opcao[]
  modos_pagamento: Opcao[]
  sim_nao: Opcao[]
  autores: { valor: string; nome: string }[]
  unidades: { valor: string; nome: string }[]
  pode_criar: boolean
}

const BASE = '/api/propostas/'

export const propostasApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: PropostaResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Proposta>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Proposta>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Proposta>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesProposta>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  previa: (visita: string | number) => pedido<Previa>(`${BASE}previa/?visita=${visita}`),
  novaRonda: (id: number, dados: unknown) => pedido<Proposta>(`${BASE}${id}/rondas/`, { json: dados }),
  editarRonda: (id: number, ronda: number, dados: unknown) =>
    pedido<Proposta>(`${BASE}${id}/rondas/${ronda}/`, { method: 'PATCH', json: dados }),
}

export const ETIQUETA_PROPOSTA: Record<string, 'sucesso' | 'aviso' | 'neutra' | 'perigo'> = {
  negociacao: 'aviso',
  aceite: 'sucesso',
  recusada: 'perigo',
  retirada: 'neutra',
  expirada: 'neutra',
}

export const NOMES_CAMPOS_PROPOSTA: Record<string, string> = {
  visita: 'Visita de origem',
  imovel: 'Imóvel',
  imovel_descricao: 'Descrição do imóvel (não registado)',
  imovel_localizacao: 'Localização do imóvel (não registado)',
  entidade: 'Comprador',
  agente_comprador: 'Agente responsável pelo comprador',
  agente_imovel: 'Agente responsável pelo imóvel',
  estado: 'Estado',
  responsavel: 'Responsável',
  observacoes: 'Observações',
}
