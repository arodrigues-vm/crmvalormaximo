// Cliente HTTP mínimo. A autorização é sempre decidida pelo servidor;
// o browser nunca é fonte de verdade dos dados do CRM.
export class ErroApi extends Error {
  estado: number

  constructor(estado: number, mensagem: string) {
    super(mensagem)
    this.estado = estado
  }
}

function lerCookie(nome: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nome}=`))
    ?.split('=')[1]
}

export async function pedido<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const metodo = (opcoes.method ?? 'GET').toUpperCase()
  const cabecalhos = new Headers(opcoes.headers)
  cabecalhos.set('Accept', 'application/json')
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    const csrf = lerCookie('csrftoken')
    if (csrf) cabecalhos.set('X-CSRFToken', csrf)
  }
  const resposta = await fetch(caminho, { ...opcoes, headers: cabecalhos, credentials: 'same-origin' })
  const corpo = resposta.headers.get('content-type')?.includes('json') ? await resposta.json() : null
  if (!resposta.ok && resposta.status !== 503) {
    throw new ErroApi(resposta.status, corpo?.detail ?? `Erro ${resposta.status}`)
  }
  return corpo as T
}

export interface Saude {
  estado: 'ok' | 'degradado'
  base_dados: string
  ambiente: string
}

export const obterSaude = () => pedido<Saude>('/api/saude/')
