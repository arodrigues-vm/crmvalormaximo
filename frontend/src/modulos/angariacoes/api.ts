import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }
type Escolha = { valor: string; nome: string }

export type Estado = 'por_assinar' | 'por_iniciar' | 'ativa' | 'renovada' | 'expirada' | 'concluida' | 'cancelada'

export interface Alerta {
  dias: number
  limiar: number
}

export interface Renovacao {
  id: number
  ciclo: number
  forma: string
  forma_nome: string
  data_inicio: string
  prazo_meses: number
  data_fim: string
  observacoes: string
  criado_em: string
  criado_por_nome: string | null
}

export interface Interveniente {
  entidade: number
  acessivel: boolean
  nome_completo: string | null
  referencia: string | null
  papel: number | null
  papel_nome: string | null
  quota: string | null
}

export interface Angariacao {
  id: number
  referencia: string
  numero_contrato: string
  imovel: number
  imovel_referencia: string
  imovel_descricao: string
  operacao: number | null
  regime: number | null
  data_assinatura: string | null
  data_inicio: string | null
  prazo_meses: number | null
  data_fim: string | null
  data_fim_vigente: string | null
  situacao: 'em_curso' | 'concluida' | 'cancelada'
  situacao_motivo: string
  estado: Estado
  estado_nome: string
  alerta: Alerta | null
  assinado: boolean
  modalidade_remuneracao: string
  valor_remuneracao: string | null
  base_contratual: string
  valor_minimo_remuneracao: string | null
  taxa_iva: string | null
  remuneracao_inclui_iva: boolean | null
  condicoes_pagamento: string
  intervenientes_detalhe: Interveniente[]
  renovacoes: Renovacao[]
  correcoes: {
    campo: string
    valor_anterior: string
    valor_novo: string
    motivo: string
    evidencia: string
    criado_em: string
    criado_por: string
  }[]
  responsavel: number
  responsavel_nome: string
  observacoes: string
  nomes: {
    operacao: string | null
    operacao_categoria: string | null
    regime: string | null
    regime_categoria: string | null
    modalidade: string | null
    situacao: string
  }
  criado_em: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface AngariacaoResumo {
  id: number
  referencia: string
  numero_contrato: string
  imovel: number
  imovel_referencia: string
  imovel_descricao: string
  operacao_nome: string | null
  regime_nome: string | null
  data_inicio: string | null
  data_fim_vigente: string | null
  estado: Estado
  estado_nome: string
  alerta: Alerta | null
  partes: string[]
  responsavel_nome: string
}

export interface OpcoesCmi {
  operacoes: Opcao[]
  regimes: Opcao[]
  papeis: Opcao[]
  modalidades: Escolha[]
  modalidades_por_operacao: Record<string, string[]>
  formas_renovacao: Escolha[]
  situacoes: Escolha[]
  estados: Record<Estado, string>
  alertas_dias: number[]
  pode_criar: boolean
  pode_transferir: boolean
  pode_restaurar: boolean
}

const BASE = '/api/angariacoes/'

export const cmiApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: AngariacaoResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Angariacao>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Angariacao>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Angariacao>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesCmi>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  renovar: (id: number, dados: unknown) => pedido<Angariacao>(`${BASE}${id}/renovar/`, { json: dados }),
  corrigir: (id: number, dados: unknown) => pedido<Angariacao>(`${BASE}${id}/corrigir/`, { json: dados }),
  situacao: (id: number, dados: unknown) => pedido<Angariacao>(`${BASE}${id}/situacao/`, { json: dados }),
  doImovel: (imovel: number) =>
    pedido<{
      angariacoes: (Pick<
        AngariacaoResumo,
        'id' | 'referencia' | 'regime_nome' | 'data_inicio' | 'data_fim_vigente' | 'estado' | 'estado_nome' | 'alerta'
      > & {
        regime: string | null
        operacao: string | null
      })[]
      outros: number
    }>(`/api/imoveis/${imovel}/angariacoes/`),
}

export const ETIQUETA_ESTADO: Record<Estado, 'sucesso' | 'aviso' | 'neutra' | 'perigo'> = {
  por_assinar: 'aviso',
  por_iniciar: 'neutra',
  ativa: 'sucesso',
  renovada: 'sucesso',
  expirada: 'perigo',
  concluida: 'neutra',
  cancelada: 'neutra',
}

export function textoAlerta(a: Alerta) {
  if (a.dias === 0) return 'Termina hoje'
  return `Termina dentro de ${a.dias} dia${a.dias === 1 ? '' : 's'}`
}

export const NOMES_CAMPOS_CMI: Record<string, string> = {
  imovel: 'Imóvel',
  numero_contrato: 'N.º do contrato',
  operacao: 'Tipo (operação)',
  regime: 'Regime',
  data_assinatura: 'Data de assinatura',
  data_inicio: 'Data de início',
  prazo_meses: 'Prazo (meses)',
  data_fim: 'Fim do ciclo inicial',
  data_fim_vigente: 'Fim em vigor',
  situacao: 'Situação',
  situacao_motivo: 'Motivo da situação',
  modalidade_remuneracao: 'Modalidade da remuneração',
  valor_remuneracao: 'Valor da remuneração',
  base_contratual: 'Base contratual',
  valor_minimo_remuneracao: 'Remuneração mínima',
  taxa_iva: 'Taxa de IVA',
  remuneracao_inclui_iva: 'IVA incluído',
  condicoes_pagamento: 'Condições de pagamento',
  responsavel: 'Responsável',
  observacoes: 'Observações',
}
