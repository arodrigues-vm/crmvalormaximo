import { useMemo, useState } from 'react'

import { pedido } from '../api/cliente'
import { useCamposPersonalizados, type DefinicaoEcra } from './disposicao'
import type { OpcaoPesquisa } from './SeletorPesquisavel'

/*
 * Valores dos campos acrescentados pelo Administrador (D-44). O servidor valida e normaliza tudo;
 * aqui só se guarda o que o utilizador escreveu até gravar.
 */

export type ValorCp = string | number | boolean | number[] | null

export interface NomeCp {
  id: number
  titulo: string
  acessivel: boolean
}

export interface RegistoCp {
  campos_personalizados?: Record<string, unknown>
  campos_personalizados_nomes?: Record<string, NomeCp[]>
}

export interface EstadoPersonalizados {
  valores: Record<string, ValorCp>
  /** Títulos dos registos ligados (campos de ligação), para os mostrar sem novos pedidos. */
  titulos: Record<string, OpcaoPesquisa[]>
  aoMudar: (chave: string, valor: ValorCp, titulos?: OpcaoPesquisa[]) => void
  alterado: boolean
  paraApi: () => Record<string, ValorCp>
}

/** Caminho da ficha de cada ecrã, para as ligações entre módulos. */
export const CAMINHOS: Record<string, string> = {
  entidades: '/entidades',
  imoveis: '/imoveis',
  angariacoes: '/angariacoes',
  oportunidades: '/oportunidades',
  procuras: '/procuras',
  visitas: '/visitas',
  interesses: '/visitas/interesses',
  propostas: '/propostas',
  agentes: '/agentes',
  agencias: '/agencias',
}

export const procurarRegistos = (ecra: string) => (termo: string) =>
  pedido<OpcaoPesquisa[]>(
    `/api/campos-personalizados/procurar/?ecra=${encodeURIComponent(ecra)}&q=${encodeURIComponent(termo)}`,
  )

/** Estado dos campos personalizados de um formulário. */
export function usePersonalizados(def: DefinicaoEcra, registo?: RegistoCp): EstadoPersonalizados {
  const campos = useCamposPersonalizados(def).data?.campos ?? []
  const inicial = useMemo(
    () => ({
      valores: { ...(registo?.campos_personalizados ?? {}) } as Record<string, ValorCp>,
      titulos: Object.fromEntries(
        Object.entries(registo?.campos_personalizados_nomes ?? {}).map(([k, v]) => [
          k,
          v.map((x) => ({ id: x.id, titulo: x.titulo })),
        ]),
      ),
    }),
    [registo],
  )
  const [estado, setEstado] = useState(inicial)
  return {
    ...estado,
    alterado: JSON.stringify(estado.valores) !== JSON.stringify(inicial.valores),
    aoMudar: (chave, valor, titulos) =>
      setEstado((a) => ({
        valores: { ...a.valores, [chave]: valor },
        titulos: titulos ? { ...a.titulos, [chave]: titulos } : a.titulos,
      })),
    // Só se enviam os campos ativos; os desativados ficam guardados como estão.
    paraApi: () =>
      Object.fromEntries(
        campos.filter((c) => c.ativo).map((c) => [c.chave, estado.valores[c.chave] ?? ''] as [string, ValorCp]),
      ),
  }
}

/** Os tipos de cada módulo não declaram os campos personalizados; esta conversão torna-o explícito. */
export const comoRegistoCp = (r: unknown) => r as RegistoCp | undefined
