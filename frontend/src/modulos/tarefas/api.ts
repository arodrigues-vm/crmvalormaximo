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
  prioridade: number | null
  prioridade_nome: string | null
  prazo: string | null
  atrasada: boolean
  /** Tarefa de pós-venda (ligada a uma transação concluída); senão é uma tarefa geral (D-52). */
  pos_venda: boolean
  /** Ocorrência do Plano de Marketing de Imóveis (D-53). */
  marketing: boolean
  plano: number | null
  plano_referencia: string | null
  mk_numero: number | null
  mk_semana: number | null
  incluida: boolean
  transacao: number | null
  transacao_referencia: string | null
  cliente_nome: string | null
  origem: OrigemTarefa | null
  responsavel: number
  responsavel_nome: string
  criado_em: string
}

export interface OrigemTarefa {
  modulo: string
  modulo_nome: string
  id: number
  titulo: string
  caminho: string | null
}

export interface Tarefa extends TarefaResumo {
  descricao: string
  categoria: number | null
  origem_modulo: string
  origem_id: number | null
  concluida_em: string | null
  motivo_estado: string
  modelo_nome: string | null
  imovel_descricao: string | null
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
  modulo: string
  modulo_nome: string
  ativo: boolean
  ordem: number
}

export interface OpcoesTarefa {
  estados: Opcao[]
  prioridades: Opcao[]
  categorias: Opcao[]
  tipos_interacao: Opcao[]
  origens: { valor: string; nome: string }[]
  modulos_modelo: { valor: string; nome: string }[]
  pode_criar: boolean
  pode_criar_pos_venda: boolean
}

/** A que se refere uma proposta de tarefas a partir de modelos: transação concluída ou ficha de origem. */
export type AlvoModelos = { transacao: number } | { origem_modulo: string; origem_id: number }

const paramsAlvo = (a: AlvoModelos) => new URLSearchParams(Object.entries(a).map(([k, v]) => [k, String(v)])).toString()

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
  kanban: (params: Record<string, string>) => pedido<TarefaResumo[]>(`${BASE}kanban/?${new URLSearchParams(params)}`),
  mudarEstado: (id: number, estado: number, motivo = '') =>
    pedido<Tarefa>(`${BASE}${id}/mudar-estado/`, { json: { estado, motivo } }),
  proposta: (alvo: AlvoModelos) => pedido<ModeloProposto[]>(`${BASE}proposta/?${paramsAlvo(alvo)}`),
  criarDeModelos: (alvo: AlvoModelos, modelos: number[]) =>
    pedido<TarefaResumo[]>(`${BASE}criar-de-modelos/`, { json: { ...alvo, modelos } }),
  documentos: (transacao: number) => pedido<DocumentoNegocio[]>(`/api/transacoes/${transacao}/documentos/`),
}

export const modelosTarefaApi = {
  listar: () => pedido<ModeloTarefa[]>('/api/modelos-tarefa/'),
  criar: (dados: unknown) => pedido<ModeloTarefa>('/api/modelos-tarefa/', { json: dados }),
  atualizar: (id: number, dados: unknown) =>
    pedido<ModeloTarefa>(`/api/modelos-tarefa/${id}/`, { method: 'PATCH', json: dados }),
}

/** Mudar para este estado exige motivo? (reabrir uma tarefa fechada, ou cancelar). */
export const pedeMotivo = (de: string | null, para: string | undefined) =>
  para === 'cancelada' || (['concluida', 'cancelada'].includes(de ?? '') && ['aberta', 'em_curso'].includes(para ?? ''))

/** Caminho da ficha: as de pós-venda ficam no menu Pós-Venda, as gerais no menu Tarefas. */
export const caminhoTarefa = (t: { id: number; pos_venda: boolean }) =>
  t.pos_venda ? `/pos-venda/${t.id}` : `/tarefas/${t.id}`

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
  origem_modulo: 'Ligada a (módulo)',
  origem_id: 'Ligada a (registo)',
  responsavel: 'Responsável',
}
