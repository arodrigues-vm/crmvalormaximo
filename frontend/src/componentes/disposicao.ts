import { useQuery } from '@tanstack/react-query'

import { pedido } from '../api/cliente'

/*
 * Disposição configurável dos ecrãs (D-43): o Administrador escolhe a ordem dos separadores, o separador
 * de cada campo e a posição do campo dentro do separador. A mesma disposição serve a edição e a consulta.
 * Cada módulo declara a disposição de origem; o servidor guarda apenas as alterações do Administrador.
 */

export interface BlocoDisposicao {
  chave: string
  titulo: string
  campos: string[]
}

export interface DefinicaoEcra {
  /** Identificador guardado no servidor (ex.: «imoveis»). */
  modulo: string
  /** Nome mostrado nas Configurações. */
  nome: string
  padrao: BlocoDisposicao[]
  /** Nome de cada campo, para o ecrã de Configurações. */
  rotulos: Record<string, string>
  /** Ecrãs sem campos personalizados (ex.: Equipa, que não é um registo de negócio). */
  semPersonalizados?: boolean
}

/** Campo acrescentado pelo Administrador (D-44). A chave começa sempre por «cp_». */
export interface CampoPersonalizadoDef {
  id: number
  ecra: string
  chave: string
  nome: string
  tipo: string
  tipo_nome: string
  obrigatorio: boolean
  ajuda: string
  ativo: boolean
  lista: string | null
  opcoes: { id: number; nome: string; ativo: boolean }[]
  modulo_relacao: string
  em_uso?: number
}

export interface RespostaCampos {
  campos: CampoPersonalizadoDef[]
  tipos: { valor: string; nome: string }[]
  modulos: { valor: string; nome: string }[]
}

export const BLOCO_PERSONALIZADOS = { chave: 'personalizados', titulo: 'Campos adicionais' }

export const obterCampos = (ecra: string) =>
  pedido<RespostaCampos>(`/api/campos-personalizados/?ecra=${encodeURIComponent(ecra)}`)

export function useCamposPersonalizados(def: DefinicaoEcra) {
  return useQuery({
    queryKey: ['campos-personalizados', def.modulo],
    queryFn: () => obterCampos(def.modulo),
    staleTime: 5 * 60_000,
    enabled: !def.semPersonalizados,
  })
}

/** Disposição de origem com os campos personalizados ativos num separador próprio, no fim. */
export function padraoCom(def: DefinicaoEcra, campos: CampoPersonalizadoDef[]) {
  const extra = campos.filter((c) => c.ativo).map((c) => c.chave)
  return extra.length ? [...def.padrao, { ...BLOCO_PERSONALIZADOS, campos: extra }] : def.padrao
}

/** Junta a disposição guardada com a de origem: mantém a ordem guardada, ignora campos que já não existem e
 * acrescenta os campos novos (ainda não colocados) ao seu separador de origem. */
export function combinar(padrao: BlocoDisposicao[], guardada: BlocoDisposicao[] | null | undefined) {
  if (!guardada || guardada.length === 0) return padrao.map((b) => ({ ...b, campos: [...b.campos] }))
  const conhecidos = new Set(padrao.flatMap((b) => b.campos))
  const blocos = guardada.map((b) => ({ ...b, campos: b.campos.filter((c) => conhecidos.has(c)) }))
  const colocados = new Set(blocos.flatMap((b) => b.campos))
  for (const origem of padrao) {
    const faltam = origem.campos.filter((c) => !colocados.has(c))
    if (faltam.length === 0) continue
    let destino = blocos.find((b) => b.chave === origem.chave)
    if (!destino) {
      destino = { chave: origem.chave, titulo: origem.titulo, campos: [] }
      blocos.push(destino)
    }
    destino.campos.push(...faltam)
  }
  return blocos
}

export interface RespostaDisposicao {
  modulo: string
  blocos: BlocoDisposicao[] | null
  rotulos?: Record<string, string>
}

export const obterDisposicao = (modulo: string) => pedido<RespostaDisposicao>(`/api/disposicoes/${modulo}/`)

/** Disposição em vigor para um ecrã (separadores, nomes alterados e campos personalizados ativos).
 * Enquanto carrega (ou se falhar), usa a de origem. */
export function useDisposicao(def: DefinicaoEcra) {
  const { data } = useQuery({
    queryKey: ['disposicoes', def.modulo],
    queryFn: () => obterDisposicao(def.modulo),
    staleTime: 5 * 60_000,
  })
  const campos = (useCamposPersonalizados(def).data?.campos ?? []).filter((c) => c.ativo)
  return { blocos: combinar(padraoCom(def, campos), data?.blocos), rotulos: data?.rotulos ?? {}, campos }
}
