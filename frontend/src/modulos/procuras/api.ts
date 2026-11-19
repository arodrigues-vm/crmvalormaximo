import { pedido } from '../../api/cliente'
import type { CampoQualificacao } from '../../componentes/camposQualificacao'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }
export type Importancia = 'obrigatorio' | 'preferencial'

export interface ProcuraResumo {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string | null
  pretende_nome: string
  estado_nome: string | null
  estado_categoria: string | null
  urgencia_nome: string | null
  orcamento_max: string | null
  tolerancia_pct: string
  resumo: string
  responsavel_nome: string
  quando_iniciou: string
  criado_em: string
}

export interface Procura extends ProcuraResumo {
  pretende: string
  estado: number | null
  urgencia: number | null
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
  wcs_min: number | null
  imp_wcs: Importancia
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
    pretende: string
    estado: string | null
    urgencia: string | null
    [lista: string]: unknown
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
  pretende: { valor: string; nome: string }[]
  urgencias: Opcao[]
  tipos_imovel: Opcao[]
  tipologias: Opcao[]
  zonas_comerciais: Opcao[]
  zonas_exteriores: Opcao[]
  condicoes_fisicas: Opcao[]
  tipos_interacao: Opcao[]
  sim_nao: Opcao[]
  destinos_imovel: Opcao[]
  niveis_motivacao: Opcao[]
  aceita_obras: Opcao[]
  modos_pagamento: Opcao[]
  entidades_bancarias: Opcao[]
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
  casas_banho: 'Casas de banho',
  area: 'Área bruta privativa',
  zonas_exteriores: 'Zonas exteriores',
  elevador: 'Elevador',
  estacionamento: 'Estacionamento',
  condicao: 'Condição física',
}

export const NOMES_CAMPOS_PROCURA: Record<string, string> = {
  entidade: 'Comprador / arrendatário',
  pretende: 'O cliente pretende',
  estado: 'Estado',
  urgencia: 'Urgência',
  orcamento_max: 'Valor de aquisição previsto',
  tolerancia_pct: 'Tolerância (%)',
  quartos_min: 'Quartos (mínimo)',
  wcs_min: 'Casas de banho (mínimo)',
  area_min: 'Área bruta privativa mínima',
  exige_elevador: 'Elevador',
  estacionamento_min: 'Estacionamento (mínimo)',
  responsavel: 'Responsável',
  observacoes: 'Observações',
  imp_tipos: 'Importância do tipo',
  imp_tipologias: 'Importância da tipologia',
  imp_localizacao: 'Importância da localização',
  imp_quartos: 'Importância dos quartos',
  imp_wcs: 'Importância das casas de banho',
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

/** Qualificação do comprador (D-34, Excel «Procuras e Qualificação»). */
export const QUALIFICACAO_COMPRADOR: CampoQualificacao[] = [
  { campo: 'destino_imovel', rotulo: 'Destino do imóvel', tipo: 'lista', lista: 'destinos_imovel' },
  { campo: 'nivel_motivacao', rotulo: 'Motivação de compra', tipo: 'lista', lista: 'niveis_motivacao' },
  { campo: 'compra_depende_venda', rotulo: 'A compra depende da venda', tipo: 'lista', lista: 'sim_nao' },
  { campo: 'quando_iniciou', rotulo: 'Quando iniciou a procura', tipo: 'texto', ajuda: 'Ex.: «há 3 meses».' },
  { campo: 'prazo_aquisicao', rotulo: 'Prazo de aquisição', tipo: 'texto', ajuda: 'Como o cliente disse.' },
  { campo: 'motivacao', rotulo: 'Motivo para comprar', tipo: 'longo' },
  { campo: 'o_que_quer', rotulo: 'O que quer?', tipo: 'longo' },
  { campo: 'o_que_nao_quer', rotulo: 'O que não quer?', tipo: 'longo' },
  { campo: 'flexibilidade', rotulo: 'Flexibilidade', tipo: 'longo', ajuda: 'Em que aspetos é flexível.' },
]

/** Pré-qualificação financeira (D-34). */
export const PRE_QUALIFICACAO_FINANCEIRA: CampoQualificacao[] = [
  { campo: 'modo_pagamento', rotulo: 'Modo de pagamento', tipo: 'lista', lista: 'modos_pagamento' },
  { campo: 'capitais_proprios', rotulo: 'Capitais próprios', tipo: 'lista', lista: 'sim_nao' },
  { campo: 'financiamento', rotulo: 'Financiamento', tipo: 'lista', lista: 'sim_nao' },
  { campo: 'qualificacao_bancaria', rotulo: 'Qualificação bancária', tipo: 'lista', lista: 'sim_nao' },
  { campo: 'entidade_bancaria', rotulo: 'Entidade bancária', tipo: 'lista', lista: 'entidades_bancarias' },
  { campo: 'observacoes_qualificacao', rotulo: 'Observações da qualificação financeira', tipo: 'longo' },
]

/** Preferências do imóvel sem comparação automática (informativas), no fim dos critérios. */
export const CRITERIOS_INFORMATIVOS: CampoQualificacao[] = [
  { campo: 'piso', rotulo: 'Piso', tipo: 'texto', ajuda: 'Ex.: «não quer rés-do-chão».' },
  { campo: 'exposicao_solar', rotulo: 'Exposição solar', tipo: 'texto' },
  { campo: 'aceita_obras', rotulo: 'Obras', tipo: 'lista', lista: 'aceita_obras' },
]

for (const c of [...QUALIFICACAO_COMPRADOR, ...PRE_QUALIFICACAO_FINANCEIRA, ...CRITERIOS_INFORMATIVOS])
  NOMES_CAMPOS_PROCURA[c.campo] = c.rotulo
