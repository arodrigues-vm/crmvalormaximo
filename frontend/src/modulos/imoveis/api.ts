import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string }
type Escolha = { valor: string; nome: string }

export interface ProprietarioDetalhe {
  entidade: number
  acessivel: boolean
  nome_completo: string | null
  referencia: string | null
  quota: string | null
}

export interface Imovel {
  id: number
  referencia: string
  tipo: number | null
  tipologia: number | null
  operacao: 'venda' | 'arrendamento'
  estado_comercializacao: number | null
  status: 'ativo' | 'inativo' | 'arquivado'
  condicao_fisica: number | null
  preco: string | null
  rua: string
  numero_policia: string
  complemento: string
  codigo_postal: string
  localidade: string
  freguesia: number | null
  localizacao: { freguesia: string; concelho: string; distrito: string } | null
  zona_comercial: number | null
  localizacao_descritiva: string
  area_bruta_privativa: string | null
  area_bruta_dependente: string | null
  area_util: string | null
  area_terreno: string | null
  quartos: number | null
  casas_banho: number | null
  ano_construcao: number | null
  piso: string
  elevador: boolean | null
  lugares_estacionamento: number | null
  certificado_energetico: number | null
  zonas_exteriores: number[]
  descricao: string
  proprietarios_detalhe: ProprietarioDetalhe[]
  responsavel: number
  responsavel_nome: string
  observacoes: string
  nomes: {
    tipo: string | null
    tipologia: string | null
    estado_comercializacao: string | null
    condicao_fisica: string | null
    zona_comercial: string | null
    certificado_energetico: string | null
    zonas_exteriores: string[]
    operacao: string
    status: string
  }
  criado_em: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface ImovelResumo {
  id: number
  referencia: string
  tipo_nome: string | null
  tipologia_nome: string | null
  operacao: string
  estado_comercializacao_nome: string | null
  status: string
  preco: string | null
  localidade: string
  concelho: string | null
  area_bruta_privativa: string | null
  proprietarios_nomes: string[]
  responsavel_nome: string
}

export interface OpcoesImovel {
  tipos: Opcao[]
  tipologias: Opcao[]
  estados_comercializacao: Opcao[]
  condicoes_fisicas: Opcao[]
  zonas_comerciais: Opcao[]
  certificados_energeticos: Opcao[]
  zonas_exteriores: Opcao[]
  operacoes: Escolha[]
  status: Escolha[]
  pode_criar: boolean
  pode_transferir: boolean
  pode_restaurar: boolean
}

export interface ImovelDaEntidade {
  id: number
  referencia: string
  tipo: string | null
  tipologia: string | null
  localidade: string
  estado_comercializacao: string | null
  status: string
  quota: string | null
}

const BASE = '/api/imoveis/'

export const imoveisApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: ImovelResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Imovel>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Imovel>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Imovel>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesImovel>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  daEntidade: (entidade: number) =>
    pedido<{ imoveis: ImovelDaEntidade[]; outros: number }>(`/api/entidades/${entidade}/imoveis/`),
}

export const STATUS_ETIQUETA: Record<string, 'sucesso' | 'neutra' | 'aviso'> = {
  ativo: 'sucesso',
  inativo: 'aviso',
  arquivado: 'neutra',
}

export function tituloImovel(i: { tipo?: string | null; tipologia?: string | null; localidade?: string }) {
  return [[i.tipo, i.tipologia].filter(Boolean).join(' '), i.localidade].filter(Boolean).join(' · ') || 'Imóvel'
}

export const NOMES_CAMPOS_IMOVEL: Record<string, string> = {
  tipo: 'Tipo',
  tipologia: 'Tipologia',
  operacao: 'Operação',
  estado_comercializacao: 'Estado de comercialização',
  status: 'Status',
  condicao_fisica: 'Condição física',
  preco: 'Preço',
  rua: 'Rua',
  numero_policia: 'N.º de polícia',
  complemento: 'Complemento',
  codigo_postal: 'Código postal',
  localidade: 'Localidade',
  freguesia: 'Freguesia',
  zona_comercial: 'Zona comercial',
  localizacao_descritiva: 'Localização descritiva',
  area_bruta_privativa: 'Área bruta privativa',
  area_bruta_dependente: 'Área bruta dependente',
  area_util: 'Área útil',
  area_terreno: 'Área do terreno',
  quartos: 'Quartos',
  casas_banho: 'Casas de banho',
  ano_construcao: 'Ano de construção',
  piso: 'Piso',
  elevador: 'Elevador',
  lugares_estacionamento: 'Lugares de estacionamento',
  certificado_energetico: 'Certificado energético',
  descricao: 'Descrição',
  responsavel: 'Responsável',
  observacoes: 'Observações',
  eliminado_em: 'Eliminado em',
}
