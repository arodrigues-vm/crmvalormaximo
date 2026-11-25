import { useQuery } from '@tanstack/react-query'

import { equipaApi } from '../modulos/equipa/api'
import { CampoSelecao } from './campos'

/**
 * «Responsável» do registo, escolhido entre os membros da Equipa (D-41). Só aparece a quem pode atribuir
 * registos a outras pessoas (âmbito de transferência); a API volta a verificar sempre.
 */
export function CampoResponsavel({
  modulo,
  valor,
  atual,
  aoMudar,
  erro,
}: {
  modulo: string
  valor: string
  /** Responsável atual (para o mostrar mesmo que já não esteja na lista). */
  atual?: { id: number; nome: string } | null
  aoMudar: (v: string) => void
  erro?: string[] | string
}) {
  const { data = [] } = useQuery({
    queryKey: ['equipa', 'responsaveis', modulo],
    queryFn: () => equipaApi.responsaveis(modulo),
    staleTime: 60_000,
  })
  if (data.length <= 1) return null
  const opcoes = data.map((u) => ({ valor: u.id, nome: u.equipa ? `${u.nome} (${u.equipa})` : u.nome }))
  if (atual && !data.some((u) => u.id === atual.id)) opcoes.push({ valor: atual.id, nome: atual.nome })
  return (
    <CampoSelecao
      rotulo="Responsável"
      vazio={atual ? undefined : 'Eu próprio'}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      opcoes={opcoes}
      erro={erro}
      ajuda="Quem acompanha este registo. Passar a outra pessoa fica registado no histórico."
    />
  )
}
