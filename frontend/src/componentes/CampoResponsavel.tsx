import { useQuery } from '@tanstack/react-query'

import { equipaApi } from '../modulos/equipa/api'
import { useSessao } from '../app/sessao'
import { CampoSelecao, CampoTexto } from './campos'

/**
 * «Responsável» do registo, escolhido entre os membros da Equipa (D-41). Aparece sempre (D-46); só pode ser
 * mudado por quem pode atribuir registos a outras pessoas (âmbito de transferência). A API volta a verificar.
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
  const { utilizador } = useSessao()
  if (data.length <= 1) {
    // Sem escolha possível: mostra quem é (ou será) o responsável, sem poder mudar.
    return (
      <CampoTexto
        rotulo="Responsável"
        value={atual?.nome ?? data[0]?.nome ?? utilizador?.nome ?? ''}
        disabled
        readOnly
        ajuda={atual ? undefined : 'Fica como responsável quem cria o registo.'}
      />
    )
  }
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
