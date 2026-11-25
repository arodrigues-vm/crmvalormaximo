import { Fragment, type ReactNode } from 'react'

import { Bloco } from './Bloco'
import { useDisposicao, type BlocoDisposicao, type DefinicaoEcra } from './disposicao'

interface Props {
  def: DefinicaoEcra
  modo: 'editar' | 'ver'
  /** Desenha um campo. Devolve null quando o campo não se aplica (fica escondido). */
  campo: (chave: string) => ReactNode
  /** Erros de validação: abrem o separador onde estão. */
  erros?: Record<string, unknown>
  abertoInicial?: (b: BlocoDisposicao) => boolean
  /** Conteúdo extra antes do primeiro separador (ex.: fotografia) — fica ao lado dele. */
  aoLadoDoPrimeiro?: ReactNode
}

/** Desenha os separadores e os campos pela disposição em vigor. */
export function BlocosConfiguraveis({ def, modo, campo, erros = {}, abertoInicial, aoLadoDoPrimeiro }: Props) {
  const blocos = useDisposicao(def)
  const desenhar = (b: BlocoDisposicao) => {
    const itens = b.campos.map((c) => ({ c, no: campo(c) })).filter((x) => x.no !== null && x.no !== undefined)
    return (
      <Bloco
        key={b.chave}
        titulo={b.titulo}
        forcarAberto={b.campos.some((c) => erros[c])}
        abertoInicial={abertoInicial ? abertoInicial(b) : true}
      >
        {itens.length === 0 ? (
          <p className="ajuda">Sem campos para mostrar.</p>
        ) : modo === 'editar' ? (
          <div className="grelha-campos">
            {itens.map((x) => (
              <Fragment key={x.c}>{x.no}</Fragment>
            ))}
          </div>
        ) : (
          <dl className="grelha-dados">
            {itens.map((x) => (
              <Fragment key={x.c}>{x.no}</Fragment>
            ))}
          </dl>
        )}
      </Bloco>
    )
  }
  const [primeiro, ...resto] = blocos
  return (
    <>
      {aoLadoDoPrimeiro && primeiro ? (
        <div className="ficha-topo">
          {aoLadoDoPrimeiro}
          {desenhar(primeiro)}
        </div>
      ) : (
        primeiro && desenhar(primeiro)
      )}
      {resto.map(desenhar)}
    </>
  )
}

/** Envolve um campo composto (lista, seletor em cascata…) para ocupar a largura toda do separador. */
export function Largo({ children }: { children: ReactNode }) {
  return <div className="largo">{children}</div>
}
