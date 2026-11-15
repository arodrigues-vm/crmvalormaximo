import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }
export type Importancia = 'obrigatorio' | 'preferencial'

export interface ProcuraResumo {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string | null
  operacao_nome: string | null
  estado_nome: string | null
  estado_categoria: string | null
  urgencia_nome: string | null
  qualificacao: string
  orcamento_max: string | null
  tolerancia_pct: string
  resumo: string
  responsavel_nome: string
  data_inicio: string
}

export interface Procura extends ProcuraResumo {
  operacao: number
  estado: number | null
  urgencia: number | null
  motivacao: string
  flexibilidade: string
  prazo_compra: string | null
  teto: string | null
  tipos: number[]
  imp_tipos: Importancia
  tipologias: number[]
  imp_tipologias: Importancia
  concelhos: number[]
  freguesias: number[]
  zonas_comerciais: number[]
  imp_localizacao: Importancia
  quartos_min: number | null
  imp_quartos: Importancia
  area_min: string | null
  imp_area: Importancia
  zonas_exteriores: number[]
  imp_zonas_exteriores: Importancia
  exige_elevador: boolean
  imp_elevador: Importancia
  estacionamento_min: number | null
  imp_estacionamento: Importancia
  condicoes_fisicas: number[]
  imp_condicoes: Importancia
  responsavel: number
  observacoes: string
  nomes: {
    operacao: string | null
    estado: string | null
    urgencia: string | null
    qualificacao: string
    tipos: string[]
    tipologias: string[]
    concelhos: { id: number; nome: string }[]
    freguesias: { id: number; nome: string }[]
    zonas_comerciais: string[]
    zonas_exteriores: string[]
    condicoes_fisicas: string[]
  }
  criado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface Criterio {
  criterio: string
  estado: 'cumpre' | 'nao_cumpre' | 'desconhecido'
  obrigatorio: boolean
  detalhe: string
}

export interface Correspondencia {
  imovel: {
    id: number
    referencia: string
    descricao: string
    preco: string | null
    fotografia: { imovel: number; versao: number } | null
  }
  criterios: Criterio[]
  obrigatorios_por_confirmar: number
  preferencias_cumpridas: number
  preferencias_total: number
  grupo_preco: number
}

export interface ProcuraCompativel extends Omit<Correspondencia, 'imovel'> {
  procura: { id: number; referencia: string; entidade: string | null; orcamento_max: string | null }
}

export interface OpcoesProcura {
  estados: Opcao[]
  operacoes: Opcao[]
  urgencias: Opcao[]
  tipos_imovel: Opcao[]
  tipologias: Opcao[]
  zonas_comerciais: Opcao[]
  zonas_exteriores: Opcao[]
  condicoes_fisicas: Opcao[]
  tipos_interacao: Opcao[]
  qualificacoes: { valor: string; nome: string }[]
  pode_criar: boolean
}

const BASE = '/api/procuras/'

export const procurasApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: ProcuraResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Procura>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Procura>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Procura>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesProcura>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  correspondencias: (id: number) =>
    pedido<{ resultados: Correspondencia[]; teto: string | null }>(`${BASE}${id}/correspondencias/`),
  doImovel: (imovel: number) => pedido<ProcuraCompativel[]>(`/api/imoveis/${imovel}/procuras-compativeis/`),
}

export const NOMES_CRITERIOS: Record<string, string> = {
  preco: 'Preço',
  tipo: 'Tipo',
  tipologia: 'Tipologia',
  localizacao: 'Localização',
  quartos: 'Quartos',
  area: 'Área',
  zonas_exteriores: 'Zonas exteriores',
  elevador: 'Elevador',
  estacionamento: 'Estacionamento',
  condicao: 'Condição física',
}

export const NOMES_CAMPOS_PROCURA: Record<string, string> = {
  entidade: 'Interessado',
  operacao: 'Operação',
  estado: 'Estado',
  qualificacao: 'Qualificação',
  urgencia: 'Urgência',
  motivacao: 'Motivação',
  flexibilidade: 'Flexibilidade',
  prazo_compra: 'Prazo',
  data_inicio: 'Início da procura',
  orcamento_max: 'Orçamento máximo',
  tolerancia_pct: 'Tolerância (%)',
  quartos_min: 'Quartos (mínimo)',
  area_min: 'Área mínima',
  exige_elevador: 'Elevador',
  estacionamento_min: 'Estacionamento (mínimo)',
  responsavel: 'Responsável',
  observacoes: 'Observações',
  imp_tipos: 'Importância do tipo',
  imp_tipologias: 'Importância da tipologia',
  imp_localizacao: 'Importância da localização',
  imp_quartos: 'Importância dos quartos',
  imp_area: 'Importância da área',
  imp_zonas_exteriores: 'Importância das zonas exteriores',
  imp_elevador: 'Importância do elevador',
  imp_estacionamento: 'Importância do estacionamento',
  imp_condicoes: 'Importância da condição física',
}

export const procurarConcelhos = async (termo: string) =>
  (
    await pedido<{ id: number; nome: string; distrito: string }[]>(
      `/api/localizacao/concelhos/?${new URLSearchParams({ pesquisa: termo })}`,
    )
  ).map((c) => ({ id: c.id, titulo: c.nome, detalhe: c.distrito }))

export const procurarFreguesias = async (termo: string) =>
  (
    await pedido<{ id: number; nome: string; concelho: string }[]>(
      `/api/localizacao/freguesias/?${new URLSearchParams({ pesquisa: termo })}`,
    )
  ).map((f) => ({ id: f.id, titulo: f.nome, detalhe: f.concelho }))
