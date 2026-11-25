import { CampoAreaTexto, CampoSelecao, CampoTexto, Dado } from './campos'
import type { CampoQualificacao, Opcoes, Registo } from './camposQualificacao'
import { formatarArea, formatarEuros } from './formatar'

function visivel(c: CampoQualificacao, nomeEscolhido: (campo: string) => string | null | undefined) {
  return !c.mostrarSe || nomeEscolhido(c.mostrarSe.campo) === c.mostrarSe.nome
}

interface ContextoEdicao {
  valores: Record<string, string>
  aoMudar: (campo: string, valor: string) => void
  opcoes?: Opcoes
  erros: Record<string, string[] | undefined>
  /** Nomes dos valores já gravados (para mostrar um valor que entretanto foi desativado). */
  nomesAtuais?: Record<string, unknown>
  /** Todos os campos conhecidos (para resolver as condições «mostrarSe»). */
  todos?: CampoQualificacao[]
}

/** Um campo, pronto a colocar em qualquer separador (D-43). Devolve null se estiver escondido. */
export function EditarCampoQ({ c, ctx }: { c: CampoQualificacao; ctx: ContextoEdicao }) {
  const { valores, aoMudar, opcoes, erros, nomesAtuais, todos = [c] } = ctx
  const nomeEscolhido = (campo: string) => {
    const x = todos.find((y) => y.campo === campo)
    return opcoes?.[x?.lista ?? '']?.find((o) => String(o.id) === valores[campo])?.nome
  }
  if (!visivel(c, nomeEscolhido)) return null
  if (c.tipo === 'longo')
    return (
      <CampoAreaTexto
        rotulo={c.rotulo}
        value={valores[c.campo] ?? ''}
        onChange={(e) => aoMudar(c.campo, e.target.value)}
        erro={erros[c.campo]}
        ajuda={c.ajuda}
      />
    )
  if (c.tipo === 'lista') {
    const itens = (opcoes?.[c.lista!] ?? []).map((o) => ({ valor: o.id, nome: o.nome }))
    const atual = valores[c.campo]
    const nome = nomesAtuais?.[c.campo]
    if (atual && typeof nome === 'string' && !itens.some((x) => String(x.valor) === atual))
      itens.push({ valor: Number(atual), nome })
    return (
      <CampoSelecao
        rotulo={c.rotulo}
        vazio="—"
        value={atual ?? ''}
        onChange={(e) => aoMudar(c.campo, e.target.value)}
        opcoes={itens}
        erro={erros[c.campo]}
        ajuda={c.ajuda}
      />
    )
  }
  return (
    <CampoTexto
      rotulo={c.tipo === 'euros' ? `${c.rotulo} (€)` : c.tipo === 'm2' ? `${c.rotulo} (m²)` : c.rotulo}
      type={c.tipo === 'url' ? 'url' : undefined}
      placeholder={c.tipo === 'url' ? 'https://…' : undefined}
      inputMode={c.tipo === 'euros' || c.tipo === 'm2' ? 'decimal' : c.tipo === 'numero' ? 'numeric' : undefined}
      value={valores[c.campo] ?? ''}
      onChange={(e) => aoMudar(c.campo, e.target.value)}
      erro={erros[c.campo]}
      ajuda={c.ajuda}
    />
  )
}

/** Um campo na ficha de consulta (D-43). */
export function VerCampoQ({ c, registo }: { c: CampoQualificacao; registo: Registo }) {
  const nomes = registo.nomes ?? {}
  if (!visivel(c, (campo) => nomes[campo] as string | null | undefined)) return null
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
    <Dado rotulo={c.rotulo} largo={c.tipo === 'longo'}>
      {conteudo}
    </Dado>
  )
}

export function EditarQualificacao({
  campos,
  ...ctx
}: Omit<ContextoEdicao, 'todos'> & { campos: CampoQualificacao[] }) {
  return (
    <div className="grelha-campos">
      {[...campos.filter((c) => c.tipo !== 'longo'), ...campos.filter((c) => c.tipo === 'longo')].map((c) => (
        <EditarCampoQ key={c.campo} c={c} ctx={{ ...ctx, todos: campos }} />
      ))}
    </div>
  )
}

export function VerQualificacao({ campos, registo }: { campos: CampoQualificacao[]; registo: Registo }) {
  return (
    <dl className="grelha-dados">
      {campos.map((c) => (
        <VerCampoQ key={c.campo} c={c} registo={registo} />
      ))}
    </dl>
  )
}
