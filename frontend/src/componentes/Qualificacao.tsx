import { CampoAreaTexto, CampoSelecao, CampoTexto, Dado } from './campos'
import { formatarArea, formatarEuros } from './formatar'
import type { CampoQualificacao, Opcoes, Registo } from './camposQualificacao'

function visivel(c: CampoQualificacao, nomeEscolhido: (campo: string) => string | null | undefined) {
  return !c.mostrarSe || nomeEscolhido(c.mostrarSe.campo) === c.mostrarSe.nome
}

export function EditarQualificacao({
  campos,
  valores,
  aoMudar,
  opcoes,
  erros,
  nomesAtuais,
}: {
  campos: CampoQualificacao[]
  valores: Record<string, string>
  aoMudar: (campo: string, valor: string) => void
  opcoes?: Opcoes
  erros: Record<string, string[] | undefined>
  /** Nomes dos valores já gravados (para mostrar um valor que entretanto foi desativado). */
  nomesAtuais?: Record<string, unknown>
}) {
  const nomeEscolhido = (campo: string) => {
    const c = campos.find((x) => x.campo === campo)
    return opcoes?.[c?.lista ?? '']?.find((o) => String(o.id) === valores[campo])?.nome
  }
  const comAtual = (c: CampoQualificacao, itens: { valor: number; nome: string }[]) => {
    const atual = valores[c.campo]
    const nome = nomesAtuais?.[c.campo]
    return atual && typeof nome === 'string' && !itens.some((x) => String(x.valor) === atual)
      ? [...itens, { valor: Number(atual), nome }]
      : itens
  }
  const curtos = campos.filter((c) => c.tipo !== 'longo' && visivel(c, nomeEscolhido))
  const longos = campos.filter((c) => c.tipo === 'longo' && visivel(c, nomeEscolhido))
  return (
    <>
      <div className="grelha-campos">
        {curtos.map((c) =>
          c.tipo === 'lista' ? (
            <CampoSelecao
              key={c.campo}
              rotulo={c.rotulo}
              vazio="—"
              value={valores[c.campo]}
              onChange={(e) => aoMudar(c.campo, e.target.value)}
              opcoes={comAtual(
                c,
                (opcoes?.[c.lista!] ?? []).map((o) => ({ valor: o.id, nome: o.nome })),
              )}
              erro={erros[c.campo]}
              ajuda={c.ajuda}
            />
          ) : (
            <CampoTexto
              key={c.campo}
              rotulo={c.tipo === 'euros' ? `${c.rotulo} (€)` : c.tipo === 'm2' ? `${c.rotulo} (m²)` : c.rotulo}
              type={c.tipo === 'url' ? 'url' : undefined}
              placeholder={c.tipo === 'url' ? 'https://…' : undefined}
              inputMode={
                c.tipo === 'euros' || c.tipo === 'm2' ? 'decimal' : c.tipo === 'numero' ? 'numeric' : undefined
              }
              value={valores[c.campo]}
              onChange={(e) => aoMudar(c.campo, e.target.value)}
              erro={erros[c.campo]}
              ajuda={c.ajuda}
            />
          ),
        )}
      </div>
      {longos.map((c) => (
        <CampoAreaTexto
          key={c.campo}
          rotulo={c.rotulo}
          value={valores[c.campo]}
          onChange={(e) => aoMudar(c.campo, e.target.value)}
          erro={erros[c.campo]}
          ajuda={c.ajuda}
        />
      ))}
    </>
  )
}

export function VerQualificacao({ campos, registo }: { campos: CampoQualificacao[]; registo: Registo }) {
  const nomes = registo.nomes ?? {}
  const nomeEscolhido = (campo: string) => nomes[campo] as string | null | undefined
  return (
    <dl className="grelha-dados">
      {campos
        .filter((c) => visivel(c, nomeEscolhido))
        .map((c) => {
          const v = registo[c.campo]
          let conteudo: React.ReactNode = null
          if (c.tipo === 'lista') conteudo = nomes[c.campo] as string | null
          else if (c.tipo === 'euros') conteudo = v === null || v === undefined ? null : formatarEuros(v as string)
          else if (c.tipo === 'm2') conteudo = v === null || v === undefined ? null : formatarArea(v as string)
          else if (c.tipo === 'numero') conteudo = v === null || v === undefined ? null : String(v)
          else if (c.tipo === 'url' && v)
            conteudo = (
              <a href={v as string} target="_blank" rel="noopener noreferrer">
                Abrir
              </a>
            )
          else if (v) conteudo = c.tipo === 'longo' ? <span className="texto-livre">{v as string}</span> : (v as string)
          return (
            <Dado key={c.campo} rotulo={c.rotulo} largo={c.tipo === 'longo'}>
              {conteudo}
            </Dado>
          )
        })}
    </dl>
  )
}
