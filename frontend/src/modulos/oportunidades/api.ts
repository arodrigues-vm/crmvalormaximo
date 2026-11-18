import { pedido } from '../../api/cliente'
import type { EntradaHistorico } from '../../componentes/Ficha'
import type { CampoQualificacao } from '../../componentes/camposQualificacao'

type Opcao = { id: number; nome: string; categoria?: string }

export interface OportunidadeResumo {
  id: number
  referencia: string
  entidade: number
  entidade_nome: string | null
  imovel: number | null
  imovel_descricao: string
  operacao_nome: string | null
  estado_nome: string | null
  estado_categoria: string | null
  preco_pretendido: string | null
  prazo_vender: string
  responsavel_nome: string
  criado_em: string
}

export interface Oportunidade extends OportunidadeResumo {
  tipo_imovel: number | null
  tipologia: number | null
  localidade: string
  descricao_imovel: string
  url_anuncio: string
  operacao: number | null
  estado: number | null
  origem: number | null
  angariacao_gerada: number | null
  angariacao_gerada_referencia: string | null
  responsavel: number
  observacoes: string
  nomes: {
    tipo_imovel: string | null
    tipologia: string | null
    operacao: string | null
    estado: string | null
    origem: string | null
    [campo: string]: string | null
  }
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface OpcoesOportunidade {
  estados: Opcao[]
  operacoes: Opcao[]
  origens: Opcao[]
  tipos_imovel: Opcao[]
  tipologias: Opcao[]
  tipos_interacao: Opcao[]
  sim_nao: Opcao[]
  destinos_imovel: Opcao[]
  ocupacoes_imovel: Opcao[]
  niveis_motivacao: Opcao[]
  entidades_bancarias: Opcao[]
  pode_criar: boolean
}

const BASE = '/api/oportunidades/'

export const oportunidadesApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: OportunidadeResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Oportunidade>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Oportunidade>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Oportunidade>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesOportunidade>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  converter: (id: number, criar_cmi: boolean) =>
    pedido<{
      imovel: number
      imovel_referencia: string
      imovel_criado: boolean
      angariacao: number | null
      angariacao_referencia: string | null
    }>(`${BASE}${id}/converter/`, { json: { confirmar: true, criar_cmi } }),
}

export const ETIQUETA_CATEGORIA: Record<string, 'sucesso' | 'aviso' | 'neutra' | 'perigo'> = {
  aberta: 'aviso',
  ganha: 'sucesso',
  perdida: 'neutra',
  ativa: 'sucesso',
  inativa: 'neutra',
}

export const NOMES_CAMPOS_OPORTUNIDADE: Record<string, string> = {
  entidade: 'Proprietário',
  imovel: 'Imóvel',
  tipo_imovel: 'Tipo de imóvel',
  tipologia: 'Tipologia',
  localidade: 'Localidade',
  descricao_imovel: 'Descrição do imóvel',
  operacao: 'Operação',
  estado: 'Estado',
  origem: 'Origem',
  preco_pretendido: 'Valor pretendido',
  url_anuncio: 'Anúncio (site)',
  responsavel: 'Responsável',
  observacoes: 'Observações',
  angariacao_gerada: 'CMI gerado',
}

/** Qualificação do proprietário (D-34, Excel «Oportunidades de Angariação»). */
export const QUALIFICACAO_PROPRIETARIO: CampoQualificacao[] = [
  { campo: 'destino_imovel', rotulo: 'Destino do imóvel', tipo: 'lista', lista: 'destinos_imovel' },
  { campo: 'ocupacao', rotulo: 'Ocupação', tipo: 'lista', lista: 'ocupacoes_imovel' },
  { campo: 'nivel_motivacao', rotulo: 'Motivação de venda', tipo: 'lista', lista: 'niveis_motivacao' },
  { campo: 'venda_depende_compra', rotulo: 'A venda depende da compra', tipo: 'lista', lista: 'sim_nao' },
  {
    campo: 'prazo_vender',
    rotulo: 'Prazo para vender',
    tipo: 'texto',
    ajuda: 'Como o cliente disse (ex.: «até ao verão»).',
  },
  { campo: 'unico_proprietario', rotulo: 'Único proprietário', tipo: 'lista', lista: 'sim_nao' },
  {
    campo: 'todos_de_acordo',
    rotulo: 'Todos de acordo com a venda',
    tipo: 'lista',
    lista: 'sim_nao',
    mostrarSe: { campo: 'unico_proprietario', nome: 'Não' },
  },
  { campo: 'motivacao', rotulo: 'Motivo da venda', tipo: 'longo' },
  { campo: 'se_nao_vender', rotulo: 'Se não vender', tipo: 'longo' },
]

/** Negócio: compra, dívida, valor e historial de venda (D-34). */
export const QUALIFICACAO_NEGOCIO: CampoQualificacao[] = [
  { campo: 'quando_comprou', rotulo: 'Quando comprou o imóvel', tipo: 'texto' },
  { campo: 'valor_compra', rotulo: 'Valor de compra', tipo: 'euros' },
  { campo: 'valor_hipoteca', rotulo: 'Hipoteca associada', tipo: 'euros' },
  { campo: 'entidade_bancaria', rotulo: 'Entidade bancária', tipo: 'lista', lista: 'entidades_bancarias' },
  { campo: 'esta_a_venda', rotulo: 'Está à venda', tipo: 'lista', lista: 'sim_nao' },
  {
    campo: 'tempo_a_venda',
    rotulo: 'Há quanto tempo',
    tipo: 'texto',
    mostrarSe: { campo: 'esta_a_venda', nome: 'Sim' },
  },
  { campo: 'teve_visitas', rotulo: 'Teve visitas', tipo: 'lista', lista: 'sim_nao' },
  { campo: 'teve_propostas', rotulo: 'Teve propostas', tipo: 'lista', lista: 'sim_nao' },
  {
    campo: 'valor_proposta',
    rotulo: 'Valor da proposta',
    tipo: 'euros',
    mostrarSe: { campo: 'teve_propostas', nome: 'Sim' },
  },
  { campo: 'como_chegou_valor', rotulo: 'Como chegou a esse valor', tipo: 'longo' },
  {
    campo: 'porque_nao_aceitou',
    rotulo: 'Porque não aceitou',
    tipo: 'longo',
    mostrarSe: { campo: 'teve_propostas', nome: 'Sim' },
  },
  { campo: 'pontos_positivos', rotulo: 'Pontos positivos', tipo: 'longo' },
  { campo: 'objecoes', rotulo: 'Objeções', tipo: 'longo' },
]

for (const c of [...QUALIFICACAO_PROPRIETARIO, ...QUALIFICACAO_NEGOCIO]) NOMES_CAMPOS_OPORTUNIDADE[c.campo] = c.rotulo
