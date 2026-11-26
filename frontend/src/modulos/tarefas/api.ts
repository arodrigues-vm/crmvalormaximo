import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }

export interface TarefaResumo {
  id: number
  referencia: string
  titulo: string
  estado: number | null
  estado_nome: string | null
  estado_categoria: string | null
  prioridade_nome: string | null
  prazo: string | null
  atrasada: boolean
  transacao: number
  transacao_referencia: string | null
  cliente_nome: string | null
  responsavel_nome: string
  criado_em: string
}

export interface Tarefa extends TarefaResumo {
  descricao: string
  categoria: number | null
  prioridade: number | null
  concluida_em: string | null
  modelo_nome: string | null
  imovel_descricao: string | null
  responsavel: number
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface ModeloProposto {
  id: number
  nome: string
  descricao: string
  dias_apos: number
}

export interface ModeloTarefa extends ModeloProposto {
  ativo: boolean
  ordem: number
}

export interface OpcoesTarefa {
  estados: Opcao[]
  prioridades: Opcao[]
  categorias: Opcao[]
  tipos_interacao: Opcao[]
  pode_criar: boolean
}

export interface DocumentoNegocio {
  tipo: number
  nome: string
  ligacoes: { id: number; titulo: string; url: string }[]
}

const BASE = '/api/tarefas/'

export const tarefasApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: TarefaResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Tarefa>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Tarefa>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Tarefa>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesTarefa>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  proposta: (transacao: number) => pedido<ModeloProposto[]>(`${BASE}proposta/?transacao=${transacao}`),
  criarDeModelos: (transacao: number, modelos: number[]) =>
    pedido<TarefaResumo[]>(`${BASE}criar-de-modelos/`, { json: { transacao, modelos } }),
  documentos: (transacao: number) => pedido<DocumentoNegocio[]>(`/api/transacoes/${transacao}/documentos/`),
}

export const modelosTarefaApi = {
  listar: () => pedido<ModeloTarefa[]>('/api/modelos-tarefa/'),
  criar: (dados: unknown) => pedido<ModeloTarefa>('/api/modelos-tarefa/', { json: dados }),
  atualizar: (id: number, dados: unknown) =>
    pedido<ModeloTarefa>(`/api/modelos-tarefa/${id}/`, { method: 'PATCH', json: dados }),
}

export const ETIQUETA_TAREFA: Record<string, 'sucesso' | 'aviso' | 'neutra' | 'perigo'> = {
  aberta: 'aviso',
  em_curso: 'aviso',
  concluida: 'sucesso',
  cancelada: 'neutra',
}

export const NOMES_CAMPOS_TAREFA: Record<string, string> = {
  titulo: 'Título',
  descricao: 'Descrição',
  categoria: 'Categoria',
  estado: 'Estado',
  prioridade: 'Prioridade',
  prazo: 'Prazo',
  transacao: 'Transação',
  responsavel: 'Responsável',
}
