import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'
import type { ParticipanteDetalhe } from '../propostas/api'

type Opcao = { id: number; nome: string; categoria?: string }

export interface TransacaoResumo {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string | null
  imovel: number | null
  imovel_descricao_completa: string
  estado_nome: string | null
  estado_categoria: string | null
  operacao_nome: string | null
  operacao_categoria: string | null
  valor: string
  data_cpcv: string | null
  data_escritura: string | null
  data_escritura_prevista: string | null
  responsavel_nome: string
  criado_em: string
}

export interface EfeitoAplicado {
  chave: string
  descricao: string
  antes: string | null
  depois: string | null
  em: string
  por: string
  revertido: boolean
}

export interface Transacao extends TransacaoResumo {
  proposta: number
  proposta_referencia: string
  imovel_descricao: string
  imovel_localizacao: string
  angariacao: number | null
  angariacao_descricao: string | null
  operacao: number | null
  estado: number | null
  motivo_estado: string
  sinal_valor: string | null
  sinal_unidade: '' | 'percentagem' | 'euros'
  data_cpcv_prevista: string | null
  responsavel_imovel_nome: string | null
  responsavel_comprador_nome: string | null
  participantes_detalhe: ParticipanteDetalhe[]
  efeitos_aplicados: EfeitoAplicado[]
  responsavel: number
  observacoes: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface CmiEscolha {
  id: number
  descricao: string
  em_curso: boolean
  operacao: number | null
}

export interface PreviaTransacao {
  proposta: number
  proposta_referencia: string
  imovel: number | null
  imovel_descricao_completa: string
  entidade: number
  entidade_nome: string
  responsavel_imovel_nome: string | null
  responsavel_comprador_nome: string | null
  cmis: CmiEscolha[]
  cmi_sugerido: number | null
  operacao: number | null
  valor: string | null
  sinal_valor: string | null
  sinal_unidade: '' | 'percentagem' | 'euros'
  data_cpcv_prevista: string | null
  data_escritura_prevista: string | null
  participantes: { entidade: number; nome: string; papel: number | null; quota: string | null }[]
}

export interface EfeitoProposto {
  chave: string
  descricao: string
  antes: string | null
  depois: string | null
}

export interface OpcoesTransacao {
  estados: Opcao[]
  operacoes: Opcao[]
  papeis: Opcao[]
  unidades: { valor: string; nome: string }[]
  tipos_interacao: Opcao[]
  pode_criar: boolean
}

const BASE = '/api/transacoes/'

export const transacoesApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: TransacaoResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Transacao>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Transacao>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Transacao>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesTransacao>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  previa: (proposta: string | number) => pedido<PreviaTransacao>(`${BASE}previa/?proposta=${proposta}`),
  cmis: (id: number) => pedido<CmiEscolha[]>(`${BASE}${id}/cmis/`),
  efeitos: (id: number, estado: number | string) => pedido<EfeitoProposto[]>(`${BASE}${id}/efeitos/?estado=${estado}`),
  mudarEstado: (id: number, dados: unknown) => pedido<Transacao>(`${BASE}${id}/mudar-estado/`, { json: dados }),
}

export const ETIQUETA_TRANSACAO: Record<string, 'sucesso' | 'aviso' | 'neutra' | 'perigo'> = {
  preparacao: 'neutra',
  cpcv: 'aviso',
  escritura: 'aviso',
  concluida: 'sucesso',
  cancelada: 'perigo',
}

/** Estados que não existem no arrendamento (D-47). */
export const SO_VENDA = ['cpcv', 'escritura']

export const NOMES_CAMPOS_TRANSACAO: Record<string, string> = {
  angariacao: 'CMI',
  operacao: 'Operação',
  estado: 'Estado',
  motivo_estado: 'Motivo da mudança de estado',
  valor: 'Valor acordado',
  sinal_valor: 'Sinal',
  sinal_unidade: 'Unidade do sinal',
  data_cpcv_prevista: 'Data prevista do CPCV',
  data_cpcv: 'Data do CPCV',
  data_escritura_prevista: 'Data prevista da escritura / contrato',
  data_escritura: 'Data da escritura / contrato',
  responsavel: 'Responsável',
  observacoes: 'Observações',
}
