import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

import { useRotulo } from './rotulo'

interface Base {
  rotulo: string
  erro?: string[] | string
  ajuda?: ReactNode
  largo?: boolean
}

function Mensagens({ id, erro, ajuda }: { id: string; erro?: string[] | string; ajuda?: ReactNode }) {
  const erros = erro ? (Array.isArray(erro) ? erro : [erro]) : []
  return (
    <>
      {ajuda && !erros.length && <small className="campo-ajuda">{ajuda}</small>}
      {erros.length > 0 && (
        <small className="campo-erro" id={`${id}-erro`} role="alert">
          {erros.join(' ')}
        </small>
      )}
    </>
  )
}

export function CampoTexto({ rotulo, erro, ajuda, largo, ...props }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  rotulo = useRotulo(rotulo)
  return (
    <div className={`campo ${largo ? 'largo' : ''} ${erro ? 'com-erro' : ''}`}>
      <label htmlFor={id}>
        {rotulo}
        {props.required && <span className="obrigatorio"> *</span>}
      </label>
      <input id={id} aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} {...props} />
      <Mensagens id={id} erro={erro} ajuda={ajuda} />
    </div>
  )
}

export function CampoAreaTexto({
  rotulo,
  erro,
  ajuda,
  ...props
}: Base & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  rotulo = useRotulo(rotulo)
  return (
    <div className={`campo largo ${erro ? 'com-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <textarea id={id} rows={4} aria-invalid={!!erro} {...props} />
      <Mensagens id={id} erro={erro} ajuda={ajuda} />
    </div>
  )
}

export function CampoSelecao({
  rotulo,
  erro,
  ajuda,
  largo,
  opcoes,
  vazio,
  ...props
}: Base &
  SelectHTMLAttributes<HTMLSelectElement> & { opcoes: { valor: string | number; nome: string }[]; vazio?: string }) {
  const id = useId()
  rotulo = useRotulo(rotulo)
  return (
    <div className={`campo ${largo ? 'largo' : ''} ${erro ? 'com-erro' : ''}`}>
      <label htmlFor={id}>
        {rotulo}
        {props.required && <span className="obrigatorio"> *</span>}
      </label>
      <select id={id} aria-invalid={!!erro} {...props}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
      <Mensagens id={id} erro={erro} ajuda={ajuda} />
    </div>
  )
}

export function CampoCaixa({
  rotulo,
  ajuda,
  ...props
}: { rotulo: string; ajuda?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  rotulo = useRotulo(rotulo)
  return (
    <div className="campo campo-caixa">
      <input id={id} type="checkbox" {...props} />
      <label htmlFor={id}>{rotulo}</label>
      {ajuda && <small className="campo-ajuda">{ajuda}</small>}
    </div>
  )
}

/**
 * Seleção múltipla em lista suspensa (D-34): fechada mostra o que está escolhido; aberta mostra
 * caixas de seleção. Fecha com Esc ou ao clicar fora. As opções vêm sempre de listas configuráveis.
 */
export function CampoMultiplo({
  rotulo,
  opcoes,
  valores,
  aoMudar,
  erro,
  ajuda,
}: Base & { opcoes: { id: number; nome: string }[]; valores: number[]; aoMudar: (v: number[]) => void }) {
  const id = useId()
  rotulo = useRotulo(rotulo)
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  const escolhidos = opcoes.filter((o) => valores.includes(o.id)).map((o) => o.nome)
  return (
    <div
      ref={caixa}
      className={`campo campo-multiplo ${erro ? 'com-erro' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && aberto) {
          e.stopPropagation()
          setAberto(false)
        }
      }}
    >
      <label id={`${id}-rotulo`} htmlFor={id}>
        {rotulo}
      </label>
      <button
        id={id}
        type="button"
        className="lista-multipla-botao"
        aria-haspopup="true"
        aria-expanded={aberto}
        aria-labelledby={`${id}-rotulo ${id}`}
        onClick={() => setAberto((a) => !a)}
      >
        <span className={escolhidos.length ? '' : 'vazio'}>
          {escolhidos.length ? escolhidos.join(', ') : 'Selecionar…'}
        </span>
      </button>
      {aberto && (
        <div className="lista-multipla-opcoes" role="group" aria-labelledby={`${id}-rotulo`}>
          {opcoes.length === 0 && <p className="vazio">Sem opções configuradas.</p>}
          {opcoes.map((o) => (
            <label key={o.id}>
              <input
                type="checkbox"
                checked={valores.includes(o.id)}
                onChange={(e) => aoMudar(e.target.checked ? [...valores, o.id] : valores.filter((v) => v !== o.id))}
              />
              {o.nome}
            </label>
          ))}
        </div>
      )}
      <Mensagens id={id} erro={erro} ajuda={ajuda} />
    </div>
  )
}

/** Par rótulo/valor para fichas de consulta. Valores vazios mostram «—». */
export function Dado({ rotulo, children, largo }: { rotulo: string; children?: ReactNode; largo?: boolean }) {
  rotulo = useRotulo(rotulo)
  const vazio = children === null || children === undefined || children === '' || children === false
  return (
    <div className={`dado ${largo ? 'largo' : ''}`}>
      <dt>{rotulo}</dt>
      <dd>{vazio ? <span className="vazio">—</span> : children}</dd>
    </div>
  )
}
