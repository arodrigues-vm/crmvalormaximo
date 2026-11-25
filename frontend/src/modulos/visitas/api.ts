import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }
type Acoes = { editar: boolean; eliminar: boolean; transferir: boolean }

export interface VisitaResumo {
  id: number
  referencia: string
  data: string
  hora_entrada: string | null
  hora_saida: string | null
  entidade: number
  entidade_nome: string | null
  imovel: number | null
  imovel_descricao: string
  estado_nome: string | null
  estado_categoria: string | null
  responsavel_nome: string
}

export interface Visita extends Omit<VisitaResumo, 'imovel'> {
  imovel: number | null
  imovel_descricao_livre: string
  imovel_localizacao: string
  agente_comprador: number | null
  agente_comprador_nome: string | null
  agente_imovel: number | null
  agente_imovel_nome: string | null
  /** D-46: responsável pelo imóvel / pela entidade (membro da Equipa ou agente). */
  responsavel_imovel_nome?: string | null
  responsavel_comprador_nome?: string | null
  acompanhantes: number[]
  acompanhantes_detalhe: { id: number; nome: string }[]
  procura: number | null
  procura_referencia: string | null
  estado: number | null
  mais_gostou: string
  menos_gostou: string
  compraria: number | null
  responsavel: number
  observacoes: string
  nomes: Record<string, string | null>
  criado_em: string
  atualizado_em: string
  versao: number
  acoes: Acoes
  [criterio: `av_${string}`]: number | null
}

export interface OpcoesVisita {
  estados: Opcao[]
  avaliacoes: Opcao[]
  sim_nao: Opcao[]
  criterios: { campo: string; nome: string }[]
  tipos_interacao: Opcao[]
  pode_criar: boolean
}

export interface InteresseResumo {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string | null
  imovel: number
  imovel_descricao: string
  origem_nome: string | null
  grau_nome: string | null
  estado_nome: string | null
  estado_categoria: string | null
  ultima_visita: string | null
  responsavel_nome: string
  atualizado_em: string
}

export interface Interesse extends InteresseResumo {
  origem: number | null
  grau: number | null
  estado: number | null
  responsavel: number
  observacoes: string
  criado_em: string
  versao: number
  acoes: Acoes
}

export interface OpcoesInteresse {
  estados: Opcao[]
  graus: Opcao[]
  origens: Opcao[]
  tipos_interacao: Opcao[]
  pode_criar: boolean
}

type Pagina<T> = { count: number; results: T[] }

function api<R, T, O>(base: string) {
  return {
    listar: (params: Record<string, string>) => pedido<Pagina<R>>(`${base}?${new URLSearchParams(params)}`),
    obter: (id: string | number) => pedido<T>(`${base}${id}/`),
    criar: (dados: unknown) => pedido<T>(base, { json: dados }),
    atualizar: (id: number, dados: unknown) => pedido<T>(`${base}${id}/`, { method: 'PATCH', json: dados }),
    eliminar: (id: number) => pedido<null>(`${base}${id}/`, { method: 'DELETE' }),
    opcoes: () => pedido<O>(`${base}opcoes/`),
    historico: (id: number) => pedido<EntradaHistorico[]>(`${base}${id}/historico/`),
  }
}

export const visitasApi = api<VisitaResumo, Visita, OpcoesVisita>('/api/visitas/')
export const interessesApi = api<InteresseResumo, Interesse, OpcoesInteresse>('/api/interesses/')

export const ETIQUETA_VISITA: Record<string, 'sucesso' | 'aviso' | 'neutra' | 'perigo'> = {
  agendada: 'aviso',
  confirmada: 'aviso',
  realizada: 'sucesso',
  cancelada: 'neutra',
  nao_compareceu: 'perigo',
  ativo: 'sucesso',
  inativo: 'neutra',
}

export const NOMES_CAMPOS_VISITA: Record<string, string> = {
  imovel: 'Imóvel',
  imovel_descricao: 'Descrição do imóvel (não registado)',
  imovel_localizacao: 'Localização do imóvel (não registado)',
  agente_comprador: 'Agente responsável pelo comprador',
  agente_imovel: 'Agente responsável pelo imóvel',
  entidade: 'Cliente',
  procura: 'Procura',
  data: 'Data',
  hora_entrada: 'Hora de entrada',
  hora_saida: 'Hora de saída',
  estado: 'Estado',
  av_localizacao: 'Localização / zona',
  av_infraestruturas: 'Infraestruturas / serviços',
  av_construcao: 'Qualidade de construção',
  av_acabamentos: 'Acabamentos',
  av_areas: 'Áreas',
  av_planta: 'Planta do imóvel',
  av_vista: 'Vista',
  av_estacionamento: 'Estacionamento',
  av_preco: 'Preço',
  mais_gostou: 'O que mais gostou',
  menos_gostou: 'O que menos gostou',
  compraria: 'Compraria este imóvel',
  responsavel: 'Consultor',
  observacoes: 'Observações',
}

export const NOMES_CAMPOS_INTERESSE: Record<string, string> = {
  entidade: 'Cliente',
  imovel: 'Imóvel',
  origem: 'Origem',
  grau: 'Grau de interesse',
  estado: 'Estado',
  responsavel: 'Responsável',
  observacoes: 'Observações',
}

export const hora = (h: string | null) => (h ? h.slice(0, 5) : null)
