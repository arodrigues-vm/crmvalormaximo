import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { useRotulo } from './rotulo'

export interface OpcaoPesquisa {
  id: number
  titulo: string
  detalhe?: string
}

interface Props {
  rotulo: string
  /** Chave única para a cache das pesquisas. */
  chave: string
  procurar: (termo: string) => Promise<OpcaoPesquisa[]>
  valor: OpcaoPesquisa | null
  aoMudar: (o: OpcaoPesquisa | null) => void
  excluir?: number[]
  erro?: string
  placeholder?: string
}

/**
 * Seletor único pesquisável (Especificação §7): pesquisa parcial no servidor (sem acentos),
 * utilizável com teclado (↑ ↓ Enter Esc) e toque. Guarda o identificador, não o texto.
 */
export function SeletorPesquisavel({
  rotulo,
  chave,
  procurar,
  valor,
  aoMudar,
  excluir = [],
  erro,
  placeholder,
}: Props) {
  rotulo = useRotulo(rotulo)
  const id = useId()
  const [termo, setTermo] = useState('')
  const [atrasado, setAtrasado] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setAtrasado(termo.trim()), 250)
    return () => clearTimeout(t)
  }, [termo])

  const { data = [], isFetching } = useQuery({
    queryKey: ['pesquisa', chave, atrasado],
    queryFn: () => procurar(atrasado),
    enabled: aberto && atrasado.length >= 2,
    staleTime: 30_000,
  })
  const opcoes = data.filter((o) => !excluir.includes(o.id))

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  function escolher(o: OpcaoPesquisa) {
    aoMudar(o)
    setTermo('')
    setAberto(false)
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      setAtivo((a) => Math.min(a + 1, opcoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && aberto && opcoes[ativo]) {
      e.preventDefault()
      escolher(opcoes[ativo])
    } else if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  if (valor) {
    return (
      <div className="campo">
        <span className="rotulo-falso">{rotulo}</span>
        <div className="seletor-escolhido">
          <span>
            <strong>{valor.titulo}</strong>
            {valor.detalhe && <small className="ajuda"> {valor.detalhe}</small>}
          </span>
          <button type="button" className="botao-icone" aria-label={`Limpar ${rotulo}`} onClick={() => aoMudar(null)}>
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`campo seletor ${erro ? 'com-erro' : ''}`} ref={caixa}>
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder ?? 'Escreva pelo menos 2 letras…'}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value)
          setAberto(true)
          setAtivo(0)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={teclas}
      />
      {aberto && atrasado.length >= 2 && (
        <ul id={`${id}-lista`} role="listbox" className="seletor-lista">
          {opcoes.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === ativo}
              className={i === ativo ? 'ativa' : ''}
              onMouseDown={(e) => {
                e.preventDefault()
                escolher(o)
              }}
            >
              <strong>{o.titulo}</strong>
              {o.detalhe && <small> {o.detalhe}</small>}
            </li>
          ))}
          {!isFetching && opcoes.length === 0 && <li className="sem-resultados">Sem resultados.</li>}
          {isFetching && opcoes.length === 0 && <li className="sem-resultados">A procurar…</li>}
        </ul>
      )}
      {erro && (
        <small className="campo-erro" role="alert">
          {erro}
        </small>
      )}
    </div>
  )
}
