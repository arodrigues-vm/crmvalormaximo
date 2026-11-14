import { pedido } from '../../api/cliente'
import type { TelefoneEditavel } from '../../componentes/CampoTelefones'

export interface Telefone extends TelefoneEditavel {
  id: number
  numero_e164: string
  extensao: string
}

export interface Entidade {
  id: number
  referencia: string
  tipo_pessoa: 'singular' | 'coletiva'
  nome: string
  apelido: string
  nome_completo: string
  pais_fiscal: string
  nif: string
  data_nascimento: string | null
  email: string
  telefones: Telefone[]
  rua: string
  numero_policia: string
  complemento: string
  codigo_postal: string
  localidade: string
  freguesia: number | null
  localizacao: { freguesia: string; concelho: string; distrito: string; codigo: string } | null
  papeis: number[]
  papeis_nomes: string[]
  origem: number | null
  origem_nome: string | null
  responsavel: number
  responsavel_nome: string
  ativa: boolean
  observacoes: string
  consentimento_marketing: 'desconhecido' | 'concedido' | 'recusado'
  consentimento_marketing_em: string | null
  oposicao_marketing: boolean
  criado_em: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface EntidadeResumo {
  id: number
  referencia: string
  nome_completo: string
  tipo_pessoa: string
  nif: string
  email: string
  telefone_principal: string | null
  papeis_nomes: string[]
  responsavel_nome: string
  ativa: boolean
}

export interface Pagina<T> {
  count: number
  results: T[]
}

export interface Opcoes {
  papeis: { id: number; nome: string }[]
  origens: { id: number; nome: string }[]
  tipos_pessoa: { valor: string; nome: string }[]
  consentimentos: { valor: string; nome: string }[]
  tipos_telefone: { valor: string; nome: string }[]
  tipos_relacao: { id: number; nome: string; nome_inverso: string; simetrica: boolean }[]
  pode_criar: boolean
  pode_transferir: boolean
  pode_restaurar: boolean
}

export interface Candidato {
  id: number
  referencia: string
  nome_completo: string
  nif: string
  email: string
  responsavel_nome: string
  motivos: ('nif' | 'email' | 'telefone' | 'nome')[]
}

export interface Historico {
  momento: string
  tipo: string
  utilizador: string | null
  alteracoes: { campo: string; antes: string | null; depois: string | null }[]
}

export interface Relacao {
  id: number
  tipo: number
  rotulo: string
  acessivel: boolean
  entidade: { id: number; referencia: string; nome_completo: string } | null
  observacoes: string
}

const BASE = '/api/entidades/'

export const entidadesApi = {
  listar: (params: Record<string, string>) =>
    pedido<Pagina<EntidadeResumo>>(`${BASE}?${new URLSearchParams(params).toString()}`),
  obter: (id: string | number) => pedido<Entidade>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Entidade>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Entidade>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<Opcoes>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<Historico[]>(`${BASE}${id}/historico/`),
  relacoes: (id: number) => pedido<Relacao[]>(`${BASE}${id}/relacoes/`),
  criarRelacao: (id: number, dados: { tipo: number; entidade: number; sentido: string; observacoes: string }) =>
    pedido<Relacao[]>(`${BASE}${id}/relacoes/`, { json: dados }),
  removerRelacao: (id: number, relacao: number) =>
    pedido<null>(`${BASE}${id}/relacoes/${relacao}/`, { method: 'DELETE' }),
  /** Para seletores pesquisáveis. */
  procurar: async (termo: string) =>
    (await pedido<Pagina<EntidadeResumo>>(`${BASE}?${new URLSearchParams({ pesquisa: termo })}`)).results.map((e) => ({
      id: e.id,
      titulo: e.nome_completo,
      detalhe: [e.referencia, e.nif].filter(Boolean).join(' · '),
    })),
  duplicados: (dados: unknown) =>
    pedido<{ candidatos: Candidato[]; outros: number }>(`${BASE}duplicados/`, { json: dados }),
}

export const MOTIVOS: Record<Candidato['motivos'][number], string> = {
  nif: 'mesmo NIF',
  email: 'mesmo email',
  telefone: 'mesmo telefone',
  nome: 'nome semelhante',
}

export const NOMES_CAMPOS: Record<string, string> = {
  tipo_pessoa: 'Tipo de pessoa',
  nome: 'Nome',
  apelido: 'Apelido',
  pais_fiscal: 'País fiscal',
  nif: 'NIF/NIPC',
  data_nascimento: 'Data de nascimento',
  email: 'Email',
  rua: 'Rua',
  numero_policia: 'N.º de polícia',
  complemento: 'Complemento',
  codigo_postal: 'Código postal',
  localidade: 'Localidade',
  freguesia: 'Freguesia',
  origem: 'Origem',
  responsavel: 'Responsável',
  ativa: 'Ativa',
  observacoes: 'Observações',
  consentimento_marketing: 'Consentimento de marketing',
  consentimento_marketing_em: 'Data do consentimento',
  oposicao_marketing: 'Oposição a marketing',
  referencia: 'Referência',
  eliminado_em: 'Eliminada em',
}
