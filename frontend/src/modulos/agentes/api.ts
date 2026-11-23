import { pedido } from '../../api/cliente'
import type { CampoQualificacao } from '../../componentes/camposQualificacao'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }
type Pagina<T> = { count: number; results: T[] }

export interface RegistoAgente {
  id: number
  referencia: string
  nome: string
  tipo: number | null
  tipo_nome: string | null
  status: number | null
  status_nome: string | null
  status_categoria: string | null
  nif: string
  telefone: string
  telefone_e164: string
  email: string
  observacoes: string
  responsavel: number
  criado_em: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
  // Agência
  licenca_ami?: string
  nome_responsavel?: string
  site?: string
  rua?: string
  numero_policia?: string
  complemento?: string
  codigo_postal?: string
  localidade?: string
  freguesia?: number | null
  localizacao?: { freguesia: string; concelho: string; distrito: string } | null
  n_agentes?: number
  tipo_categoria?: string | null
  // Agente
  agencia?: number | null
  agencia_nome?: string | null
  utilizador?: number | null
  utilizador_nome?: string | null
}

export interface OpcoesAgentes {
  tipos: Opcao[]
  status: Opcao[]
  tipos_agencia?: Opcao[]
  utilizadores?: Opcao[]
  pode_criar: boolean
}

function api(base: string) {
  return {
    listar: (params: Record<string, string>) => pedido<Pagina<RegistoAgente>>(`${base}?${new URLSearchParams(params)}`),
    obter: (id: string | number) => pedido<RegistoAgente>(`${base}${id}/`),
    criar: (dados: unknown) => pedido<RegistoAgente>(base, { json: dados }),
    atualizar: (id: number, dados: unknown) => pedido<RegistoAgente>(`${base}${id}/`, { method: 'PATCH', json: dados }),
    eliminar: (id: number) => pedido<null>(`${base}${id}/`, { method: 'DELETE' }),
    opcoes: () => pedido<OpcoesAgentes>(`${base}opcoes/`),
    historico: (id: number) => pedido<EntradaHistorico[]>(`${base}${id}/historico/`),
    procurar: async (termo: string) =>
      (await pedido<Pagina<RegistoAgente>>(`${base}?${new URLSearchParams({ pesquisa: termo })}`)).results.map((r) => ({
        id: r.id,
        titulo: r.nome,
        detalhe: r.agencia_nome ?? r.tipo_nome ?? undefined,
      })),
  }
}

export const agenciasApi = api('/api/agencias/')
export const agentesApi = api('/api/agentes/')

export const CAMPOS_AGENCIA: CampoQualificacao[] = [
  { campo: 'nome', rotulo: 'Nome', tipo: 'texto' },
  { campo: 'tipo', rotulo: 'Tipo de agência', tipo: 'lista', lista: 'tipos' },
  { campo: 'status', rotulo: 'Status', tipo: 'lista', lista: 'status' },
  { campo: 'nif', rotulo: 'NIF/NIPC', tipo: 'texto' },
  { campo: 'licenca_ami', rotulo: 'Licença AMI', tipo: 'texto' },
  { campo: 'nome_responsavel', rotulo: 'Responsável', tipo: 'texto' },
  { campo: 'telefone', rotulo: 'Telefone', tipo: 'texto' },
  { campo: 'email', rotulo: 'Email', tipo: 'texto' },
  { campo: 'site', rotulo: 'Site', tipo: 'url' },
]

export const MORADA_AGENCIA: CampoQualificacao[] = [
  { campo: 'rua', rotulo: 'Rua', tipo: 'texto' },
  { campo: 'numero_policia', rotulo: 'N.º de polícia', tipo: 'texto' },
  { campo: 'complemento', rotulo: 'Complemento', tipo: 'texto' },
  { campo: 'codigo_postal', rotulo: 'Código postal', tipo: 'texto' },
  { campo: 'localidade', rotulo: 'Localidade', tipo: 'texto' },
]

export const CAMPOS_AGENTE: CampoQualificacao[] = [
  { campo: 'nome', rotulo: 'Nome', tipo: 'texto' },
  { campo: 'tipo', rotulo: 'Tipo de agente', tipo: 'lista', lista: 'tipos' },
  { campo: 'status', rotulo: 'Status', tipo: 'lista', lista: 'status' },
  { campo: 'nif', rotulo: 'NIF', tipo: 'texto' },
  { campo: 'telefone', rotulo: 'Telefone', tipo: 'texto' },
  { campo: 'email', rotulo: 'Email', tipo: 'texto' },
  {
    campo: 'utilizador',
    rotulo: 'Utilizador da aplicação',
    tipo: 'lista',
    lista: 'utilizadores',
    ajuda: 'Só para consultores da agência que entram no CRM. Não dá nem tira acessos.',
  },
]

export const OBSERVACOES: CampoQualificacao[] = [{ campo: 'observacoes', rotulo: 'Observações', tipo: 'longo' }]
