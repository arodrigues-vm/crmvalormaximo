import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }

export interface OportunidadeResumo {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string | null
  imovel: number | null
  imovel_descricao: string
  operacao_nome: string | null
  estado_nome: string | null
  estado_categoria: string | null
  qualificacao: string
  preco_pretendido: string | null
  prazo: string | null
  responsavel_nome: string
  criado_em: string
}

export interface Oportunidade extends OportunidadeResumo {
  tipo_imovel: number | null
  tipologia: number | null
  localidade: string
  descricao_imovel: string
  operacao: number | null
  estado: number | null
  origem: number | null
  motivacao: string
  angariacao_gerada: number | null
  angariacao_gerada_referencia: string | null
  responsavel: number
  observacoes: string
  nomes: {
    tipo_imovel: string | null
    tipologia: string | null
    operacao: string | null
    estado: string | null
    origem: string | null
    qualificacao: string
  }
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface OpcoesOportunidade {
  estados: Opcao[]
  operacoes: Opcao[]
  origens: Opcao[]
  tipos_imovel: Opcao[]
  tipologias: Opcao[]
  tipos_interacao: Opcao[]
  qualificacoes: { valor: string; nome: string }[]
  pode_criar: boolean
}

const BASE = '/api/oportunidades/'

export const oportunidadesApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: OportunidadeResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Oportunidade>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Oportunidade>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Oportunidade>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesOportunidade>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  converter: (id: number, criar_cmi: boolean) =>
    pedido<{
      imovel: number
      imovel_referencia: string
      imovel_criado: boolean
      angariacao: number | null
      angariacao_referencia: string | null
    }>(`${BASE}${id}/converter/`, { json: { confirmar: true, criar_cmi } }),
}

export const ETIQUETA_CATEGORIA: Record<string, 'sucesso' | 'aviso' | 'neutra' | 'perigo'> = {
  aberta: 'aviso',
  ganha: 'sucesso',
  perdida: 'neutra',
  ativa: 'sucesso',
  inativa: 'neutra',
}

export const NOMES_CAMPOS_OPORTUNIDADE: Record<string, string> = {
  entidade: 'Proprietário',
  imovel: 'Imóvel',
  tipo_imovel: 'Tipo de imóvel',
  tipologia: 'Tipologia',
  localidade: 'Localidade',
  descricao_imovel: 'Descrição do imóvel',
  operacao: 'Operação',
  estado: 'Estado',
  qualificacao: 'Qualificação',
  origem: 'Origem',
  motivacao: 'Motivação',
  preco_pretendido: 'Preço pretendido',
  prazo: 'Prazo',
  responsavel: 'Responsável',
  observacoes: 'Observações',
  angariacao_gerada: 'CMI gerado',
}
