import { Fragment, type ReactNode } from 'react'

import { Bloco } from './Bloco'
import { EditarCampoPersonalizado, VerCampoPersonalizado } from './CampoPersonalizado'
import { useDisposicao, type BlocoDisposicao, type DefinicaoEcra } from './disposicao'
import type { EstadoPersonalizados, RegistoCp } from './personalizados'
import { RotuloCtx, useRotulo } from './rotulo'

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
  /** Conteúdo entre o primeiro e o segundo separador (ex.: aviso de possíveis duplicados). */
  depoisDoPrimeiro?: ReactNode
  /** Resumo mostrado no título quando o separador está recolhido. */
  resumo?: (b: BlocoDisposicao) => ReactNode
  /** Campos acrescentados pelo Administrador (D-44): estado do formulário (edição)… */
  personalizados?: EstadoPersonalizados
  /** …ou o registo (consulta). */
  registo?: RegistoCp
}

/** Desenha os separadores e os campos pela disposição em vigor. */
export function BlocosConfiguraveis({
  def,
  modo,
  campo,
  erros = {},
  abertoInicial,
  aoLadoDoPrimeiro,
  depoisDoPrimeiro,
  resumo,
  personalizados,
  registo,
}: Props) {
  const { blocos, rotulos, campos } = useDisposicao(def)
  const desenharCampo = (c: string): ReactNode => {
    const cp = campos.find((x) => x.chave === c)
    if (cp) {
      if (modo === 'editar')
        return personalizados ? (
          <EditarCampoPersonalizado c={cp} estado={personalizados} erro={erros[c] as string[] | undefined} />
        ) : null
      return <VerCampoPersonalizado c={cp} registo={registo ?? {}} />
    }
    const no = campo(c)
    // O nome escolhido pelo Administrador chega ao campo pelo contexto (D-44).
    return no === null || no === undefined ? null : (
      <RotuloCtx.Provider value={rotulos[c] ?? null}>{no}</RotuloCtx.Provider>
    )
  }
  const desenhar = (b: BlocoDisposicao) => {
    const itens = b.campos.map((c) => ({ c, no: desenharCampo(c) })).filter((x) => x.no !== null)
    // Um separador sem nenhum campo aplicável (ex.: dados pessoais de uma empresa) não aparece.
    if (itens.length === 0) return null
    return (
      <Bloco
        key={b.chave}
        titulo={b.titulo}
        forcarAberto={b.campos.some((c) => erros[c])}
        abertoInicial={abertoInicial ? abertoInicial(b) : true}
        resumo={resumo?.(b)}
      >
        {modo === 'editar' ? (
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
      {depoisDoPrimeiro}
      {resto.map(desenhar)}
    </>
  )
}

/** Envolve um campo composto (lista, seletor em cascata…) para ocupar a largura toda do separador.
 * Se o Administrador lhe deu outro nome, mostra-o como título; os campos interiores mantêm os seus nomes. */
export function Largo({ children }: { children: ReactNode }) {
  const nome = useRotulo('')
  return (
    <div className="largo">
      {nome && <h4 className="subtitulo-bloco">{nome}</h4>}
      <RotuloCtx.Provider value={null}>{children}</RotuloCtx.Provider>
    </div>
  )
}

/** Desenha o conteúdo sem aplicar o nome alterado (ex.: segundo dado de um campo que mostra dois). */
export function SemRotulo({ children }: { children: ReactNode }) {
  return <RotuloCtx.Provider value={null}>{children}</RotuloCtx.Provider>
}
