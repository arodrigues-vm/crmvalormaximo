// Cliente HTTP. A autorização é sempre decidida pelo servidor;
// o browser nunca é fonte de verdade dos dados do CRM.
export class ErroApi extends Error {
  estado: number
  /** Erros de validação por campo (pedidos 400). */
  campos: Record<string, string[]>
  /** Corpo completo da resposta de erro (ex.: `codigo`, `candidatos`). */
  corpo: Record<string, unknown>

  constructor(estado: number, mensagem: string, corpo: Record<string, unknown> = {}) {
    super(mensagem)
    this.estado = estado
    this.corpo = corpo
    this.campos = corpo as Record<string, string[]>
  }
}

function lerCookie(nome: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nome}=`))
    ?.split('=')[1]
}

async function garantirCsrf(): Promise<string | undefined> {
  let token = lerCookie('csrftoken')
  if (!token) {
    await fetch('/api/auth/csrf/', { credentials: 'same-origin' })
    token = lerCookie('csrftoken')
  }
  return token
}

export async function pedido<T>(caminho: string, opcoes: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...resto } = opcoes
  const metodo = (resto.method ?? (json !== undefined ? 'POST' : 'GET')).toUpperCase()
  const cabecalhos = new Headers(resto.headers)
  cabecalhos.set('Accept', 'application/json')
  if (json !== undefined) cabecalhos.set('Content-Type', 'application/json')
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    const csrf = await garantirCsrf()
    if (csrf) cabecalhos.set('X-CSRFToken', csrf)
  }
  const resposta = await fetch(caminho, {
    ...resto,
    method: metodo,
    headers: cabecalhos,
    credentials: 'same-origin',
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  })
  const corpo = resposta.headers.get('content-type')?.includes('json') ? await resposta.json() : null
  if (!resposta.ok) {
    const { detail, ...resto } = (corpo ?? {}) as { detail?: string } & Record<string, unknown>
    throw new ErroApi(resposta.status, detail ?? `Erro ${resposta.status}`, resto)
  }
  return corpo as T
}

export interface Saude {
  estado: 'ok' | 'degradado'
  base_dados: string
  ambiente: string
}

export const obterSaude = () => pedido<Saude>('/api/saude/')

export type Ambito = 'nenhum' | 'atribuidos' | 'equipa' | 'todos'
export type Operacao =
  | 'consultar'
  | 'criar'
  | 'editar'
  | 'eliminar'
  | 'restaurar'
  | 'aprovar'
  | 'exportar'
  | 'partilhar'
  | 'transferir'
  | 'administrar'

export interface UtilizadorAtual {
  id: number
  email: string
  nome: string
  perfil: string
  perfil_nome: string
  equipa: number | null
  equipa_nome: string | null
  permissoes: Record<string, Record<Operacao, Ambito>>
  mfa_ativa: boolean
  mfa_configuracao_pendente: boolean
}

export type RespostaEntrar = UtilizadorAtual | { mfa_necessaria: true }

export const auth = {
  eu: async (): Promise<UtilizadorAtual | null> => {
    try {
      return await pedido<UtilizadorAtual>('/api/auth/eu/')
    } catch (e) {
      if (e instanceof ErroApi && e.estado === 401) return null
      throw e
    }
  },
  entrar: (email: string, password: string) =>
    pedido<RespostaEntrar>('/api/auth/entrar/', { json: { email, password } }),
  verificarMfa: (codigo: string) => pedido<UtilizadorAtual>('/api/auth/mfa/verificar/', { json: { codigo } }),
  configurarMfa: () => pedido<{ segredo: string; uri: string }>('/api/auth/mfa/configurar/', { method: 'POST' }),
  ativarMfa: (codigo: string) =>
    pedido<{ codigos_recuperacao: string[] }>('/api/auth/mfa/ativar/', { json: { codigo } }),
  sair: () => pedido<null>('/api/auth/sair/', { method: 'POST' }),
  recuperar: (email: string) => pedido<null>('/api/auth/recuperar/', { json: { email } }),
  confirmar: (uid: string, token: string, nova_password: string) =>
    pedido<null>('/api/auth/recuperar/confirmar/', { json: { uid, token, nova_password } }),
}
