import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'
import type { TarefaResumo } from '../tarefas/api'

export type Cor = 'neutro' | 'vermelho' | 'amarelo' | 'verde'

export interface Indicadores {
  semanas: { semana: number; incluidas: number; concluidas: number; cor: Cor }[]
  incluidas: number
  concluidas: number
  cor: Cor
  total: number
}

export interface PedidoRecalculo {
  id: number
  data_base_anterior: string
  data_base_nova: string
  motivo: string
  pedido_por: number
  pedido_por_nome: string
  pedido_em: string
  estado: 'pendente' | 'aprovado' | 'recusado'
  decidido_por_nome: string | null
  decidido_em: string | null
  motivo_decisao: string
}

export interface PlanoResumo {
  id: number
  referencia: string
  imovel: number
  imovel_descricao: string
  angariacao: number
  angariacao_referencia: string
  ciclo: number
  data_base: string
  ativo: boolean
  responsavel: number
  responsavel_nome: string
  indicadores: Indicadores
  criado_em: string
}

export interface SituacaoPlano {
  plano_inicial: boolean
  motivo_inicial: string | null
  novo_ciclo: { renovacao: number; ciclo: number; data_inicio: string } | null
}

export interface Opcao {
  valor: string
  nome: string
}

export interface PreviaCiclo {
  angariacao: number
  renovacao: number
  ciclo: number
  data_base: string
  origem: string
  responsavel_nome: string
  anterior: {
    id: number
    referencia: string
    ciclo: number
    pendentes: { tarefa: number; numero: number; titulo: string; prazo: string | null }[]
  }
  ocorrencias: PreviaPlano['ocorrencias']
  origens: Opcao[]
  destinos: Opcao[]
}

export interface Plano extends PlanoResumo {
  ocorrencias: TarefaResumo[]
  angariacao_data_inicio: string | null
  pedido_pendente: PedidoRecalculo | null
  pedidos: PedidoRecalculo[]
  plano_anterior: number | null
  plano_anterior_referencia: string | null
  ciclos_seguintes: { id: number; referencia: string; ciclo: number }[]
  renovacao: number | null
  renovacao_data_inicio: string | null
  origem_ciclo: string
  destino_pendentes: string
  observacoes: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean; aprovar: boolean }
}

export interface PreviaPlano {
  angariacao: number
  imovel: number
  data_base: string
  responsavel: number
  responsavel_nome: string
  ocorrencias: { numero: number; semana: number; designacao: string; prazo: string; incluida: boolean }[]
}

export interface PreviaRecalculo {
  data_base_atual: string
  data_base_nova: string | null
  ocorrencias: { tarefa: number; numero: number; titulo: string; prazo_atual: string | null; prazo_novo: string }[]
}

const BASE = '/api/planos-marketing/'

export const planosApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: PlanoResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Plano>(`${BASE}${id}/`),
  atualizar: (id: number, dados: unknown) => pedido<Plano>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  situacao: (angariacao: number) => pedido<SituacaoPlano>(`${BASE}situacao/?angariacao=${angariacao}`),
  previaCiclo: (angariacao: number, origem: string) =>
    pedido<PreviaCiclo>(`${BASE}previa-ciclo/?angariacao=${angariacao}&origem=${origem}`),
  novoCiclo: (dados: { angariacao: number; origem: string; destino: string; excluidos: number[] }) =>
    pedido<Plano>(`${BASE}novo-ciclo/`, { json: dados }),
  previa: (angariacao: number) => pedido<PreviaPlano>(`${BASE}previa/?angariacao=${angariacao}`),
  criar: (angariacao: number, excluidos: number[]) => pedido<Plano>(BASE, { json: { angariacao, excluidos } }),
  incluir: (id: number, tarefa: number, incluida: boolean) =>
    pedido<Plano>(`${BASE}${id}/incluir/`, { json: { tarefa, incluida } }),
  previaRecalculo: (id: number) => pedido<PreviaRecalculo>(`${BASE}${id}/previa-recalculo/`),
  pedirRecalculo: (id: number, motivo: string) => pedido<Plano>(`${BASE}${id}/pedir-recalculo/`, { json: { motivo } }),
  decidirRecalculo: (id: number, aprovar: boolean, motivo = '') =>
    pedido<Plano>(`${BASE}${id}/decidir-recalculo/`, { json: { aprovar, motivo } }),
}

export const NOMES_COR: Record<Cor, string> = {
  neutro: 'sem tarefas incluídas',
  vermelho: 'nenhuma concluída',
  amarelo: 'em curso',
  verde: 'todas concluídas',
}

export const NOMES_CAMPOS_PLANO: Record<string, string> = {
  observacoes: 'Observações',
  responsavel: 'Responsável',
}
