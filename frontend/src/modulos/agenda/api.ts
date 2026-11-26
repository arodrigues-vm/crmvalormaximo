import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }

export type Origem = 'compromisso' | 'visita' | 'tarefa' | 'aniversario'

export interface Evento {
  chave: string
  origem: Origem
  titulo: string
  data: string
  inicio: string | null
  fim: string | null
  dia_inteiro: boolean
  estado_nome: string | null
  estado_categoria: string | null
  caminho: string
  responsavel: number | null
  responsavel_nome: string | null
  detalhe: string
}

export interface Aviso {
  chave: string
  origem: Origem
  titulo: string
  momento: string | null
  caminho: string
}

export interface Compromisso {
  id: number
  referencia: string
  titulo: string
  tipo: number | null
  tipo_nome: string | null
  inicio: string
  fim: string | null
  local: string
  descricao: string
  estado: number | null
  estado_nome: string | null
  estado_categoria: string | null
  motivo_estado: string
  entidade: number | null
  entidade_nome: string | null
  imovel: number | null
  imovel_descricao: string | null
  responsavel: number
  responsavel_nome: string
  criado_em: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface OpcoesAgenda {
  tipos: Opcao[]
  estados: Opcao[]
  tipos_interacao: Opcao[]
  pessoas: { id: number; nome: string }[]
  pode_criar: boolean
}

const BASE = '/api/agenda/compromissos/'

export const agendaApi = {
  eventos: (params: Record<string, string>) => pedido<Evento[]>(`${BASE}eventos/?${new URLSearchParams(params)}`),
  avisos: () => pedido<Aviso[]>(`${BASE}avisos/`),
  dispensar: (chave: string) => pedido<null>(`${BASE}avisos/dispensar/`, { json: { chave } }),
  obter: (id: string | number) => pedido<Compromisso>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Compromisso>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Compromisso>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesAgenda>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  mudarEstado: (id: number, estado: number, motivo = '') =>
    pedido<Compromisso>(`${BASE}${id}/mudar-estado/`, { json: { estado, motivo } }),
}

export const NOMES_ORIGEM: Record<Origem, string> = {
  compromisso: 'Compromisso',
  visita: 'Visita',
  tarefa: 'Tarefa',
  aniversario: 'Aniversário',
}

export const NOMES_CAMPOS_COMPROMISSO: Record<string, string> = {
  titulo: 'Título',
  tipo: 'Tipo',
  inicio: 'Início',
  fim: 'Fim',
  local: 'Local',
  descricao: 'Descrição',
  estado: 'Estado',
  motivo_estado: 'Motivo',
  entidade: 'Entidade',
  imovel: 'Imóvel',
  responsavel: 'Responsável',
}
