import { agentesApi } from '../modulos/agentes/api'
import { CampoTexto } from './campos'
import { SeletorPesquisavel, type OpcaoPesquisa } from './SeletorPesquisavel'

/*
 * D-46 (visitas e propostas): o responsável pelo imóvel vem da ficha do imóvel e o responsável pela entidade
 * vem da ficha da entidade; só se escolhem em Agentes para imóveis não registados e para «Cliente externo».
 * O servidor faz a mesma regra e é quem decide; aqui só se mostra o resultado.
 */

interface Props {
  rotulo: string
  /** Escolher em Agentes (imóvel não registado / cliente externo). */
  escolher: boolean
  /** Nome vindo da ficha (quando não se escolhe). */
  daFicha?: string | null
  /** Texto quando a ficha ainda não está escolhida ou não tem responsável. */
  semFicha: string
  valor: OpcaoPesquisa | null
  aoMudar: (x: OpcaoPesquisa | null) => void
  erro?: string[]
}

export function CampoResponsavelVisita({ rotulo, escolher, daFicha, semFicha, valor, aoMudar, erro }: Props) {
  if (escolher)
    return (
      <SeletorPesquisavel
        rotulo={rotulo}
        chave="agentes"
        procurar={agentesApi.procurar}
        valor={valor}
        aoMudar={aoMudar}
        erro={erro?.join(' ')}
        placeholder="Nome do agente ou da agência"
      />
    )
  return (
    <CampoTexto
      rotulo={rotulo}
      value={daFicha ?? semFicha}
      disabled
      readOnly
      erro={erro}
      ajuda={daFicha ? 'Vem da ficha.' : undefined}
    />
  )
}
