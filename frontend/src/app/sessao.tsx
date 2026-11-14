import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'

import { auth, type Operacao, type UtilizadorAtual } from '../api/cliente'

interface Sessao {
  utilizador: UtilizadorAtual | null
  aCarregar: boolean
  /** Devolve 'mfa' quando é preciso o código de dois passos. */
  entrar: (email: string, password: string) => Promise<'ok' | 'mfa'>
  verificarMfa: (codigo: string) => Promise<void>
  atualizar: () => Promise<void>
  sair: () => Promise<void>
  pode: (modulo: string, operacao?: Operacao) => boolean
}

const ContextoSessao = createContext<Sessao | null>(null)

export const CHAVE_SESSAO = ['sessao', 'eu'] as const

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: CHAVE_SESSAO, queryFn: auth.eu, staleTime: 5 * 60_000 })
  const utilizador = data ?? null

  // Remove os dados em cache de outro utilizador, mantendo a consulta da sessão
  // (que está a ser observada; não pode ser destruída).
  const limparDados = useCallback(() => qc.removeQueries({ predicate: (q) => q.queryKey[0] !== CHAVE_SESSAO[0] }), [qc])

  const entrar = useCallback(
    async (email: string, password: string) => {
      const r = await auth.entrar(email, password)
      if ('mfa_necessaria' in r) return 'mfa' as const
      limparDados()
      qc.setQueryData(CHAVE_SESSAO, r)
      return 'ok' as const
    },
    [qc, limparDados],
  )

  const verificarMfa = useCallback(
    async (codigo: string) => {
      const u = await auth.verificarMfa(codigo)
      limparDados()
      qc.setQueryData(CHAVE_SESSAO, u)
    },
    [qc, limparDados],
  )

  const atualizar = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: CHAVE_SESSAO })
  }, [qc])

  const sair = useCallback(async () => {
    try {
      await auth.sair()
    } finally {
      limparDados()
      qc.setQueryData(CHAVE_SESSAO, null)
    }
  }, [qc, limparDados])

  // Apenas para adaptar a interface; o servidor volta a verificar sempre.
  const pode = useCallback(
    (modulo: string, operacao: Operacao = 'consultar') =>
      (utilizador?.permissoes[modulo]?.[operacao] ?? 'nenhum') !== 'nenhum',
    [utilizador],
  )

  const valor = useMemo(
    () => ({ utilizador, aCarregar: isLoading, entrar, verificarMfa, atualizar, sair, pode }),
    [utilizador, isLoading, entrar, verificarMfa, atualizar, sair, pode],
  )
  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSessao(): Sessao {
  const s = useContext(ContextoSessao)
  if (!s) throw new Error('useSessao fora de ProvedorSessao')
  return s
}
