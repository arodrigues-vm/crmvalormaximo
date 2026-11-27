import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

export interface Opcao {
  valor: string
  nome: string
}

export interface Passo {
  id?: number
  nome: string
  descricao: string
  dias: number
  periodicidade_dias: number | null
  responsavel: number | null
  responsavel_nome?: string | null
  ativo: boolean
  ordem?: number
}

export type Criterios = Partial<Record<'papeis' | 'status' | 'origens' | 'zonas' | 'concelhos', number[]>>

export interface PlanoEntidades {
  id: number
  nome: string
  descricao: string
  objetivo: string
  fundamento: string
  criterios: Criterios
  criterios_nomes: Record<string, { id: number; nome: string }[]>
  gatilhos: string[]
  ativo: boolean
  ordem: number
  passos: Passo[]
  criado_em: string
}

export interface OpcoesPlanos {
  fundamentos: Opcao[]
  gatilhos: Opcao[]
  criterios: Opcao[]
  papeis: { id: number; nome: string }[]
  status: { id: number; nome: string }[]
  origens: { id: number; nome: string }[]
  zonas: { id: number; nome: string }[]
  pode_configurar: boolean
}

export interface ResumoPublico {
  total: number
  oposicao: number
  sem_consentimento: number
  autorizadas: number
  ja_inscritas: number
  a_inscrever: number
}

export interface Inscricao {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string
  plano: number
  plano_nome: string
  plano_fundamento: string
  inicio: string
  origem: string
  origem_nome: string
  estado: 'ativa' | 'terminada'
  terminada_em: string | null
  motivo_fim: string
  responsavel: number
  responsavel_nome: string
  progresso: { total: number; concluidas: number; por_fazer: number }
  criado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean }
}

const P = '/api/marketing-entidades/planos/'
const I = '/api/marketing-entidades/inscricoes/'

export const planosEntidadesApi = {
  listar: () => pedido<PlanoEntidades[]>(P),
  opcoes: () => pedido<OpcoesPlanos>(`${P}opcoes/`),
  criar: (d: unknown) => pedido<PlanoEntidades>(P, { json: d }),
  atualizar: (id: number, d: unknown) => pedido<PlanoEntidades>(`${P}${id}/`, { method: 'PATCH', json: d }),
  publico: (id: number) => pedido<ResumoPublico>(`${P}${id}/publico/`),
  iniciarPublico: (id: number) => pedido<{ inscritas: number }>(`${P}${id}/iniciar-publico/`, { json: {} }),
}

export const inscricoesApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: Inscricao[] }>(`${I}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Inscricao>(`${I}${id}/`),
  criar: (entidade: number, plano: number) => pedido<Inscricao>(I, { json: { entidade, plano } }),
  terminar: (id: number, motivo: string) => pedido<Inscricao>(`${I}${id}/terminar/`, { json: { motivo } }),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${I}${id}/historico/`),
}

export const NOMES_CAMPOS_INSCRICAO: Record<string, string> = { estado: 'Estado', motivo_fim: 'Motivo do fim' }
