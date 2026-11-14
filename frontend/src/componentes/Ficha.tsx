import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { momentoPt } from './formatar'

export interface EntradaHistorico {
  momento: string
  tipo: string
  utilizador: string | null
  alteracoes: { campo: string; antes: string | null; depois: string | null }[]
}

export function CabecalhoRegisto({
  modulo,
  caminho,
  referencia,
  titulo,
  etiqueta,
  acoes,
}: {
  modulo: string
  caminho: string
  referencia: string
  titulo: ReactNode
  etiqueta?: { texto: string; tipo: 'sucesso' | 'neutra' | 'aviso' | 'perigo' }
  acoes?: ReactNode
}) {
  return (
    <div className="cabecalho-ficha">
      <div>
        <p className="ficha-referencia">
          <Link to={caminho}>{modulo}</Link> / {referencia}
        </p>
        <h2 className="ficha-titulo">
          {titulo}
          {etiqueta && <span className={`etiqueta etiqueta-${etiqueta.tipo}`}>{etiqueta.texto}</span>}
        </h2>
      </div>
      {acoes && <div className="ficha-acoes">{acoes}</div>}
    </div>
  )
}

/** Histórico de alterações de um registo (carregado só quando é mostrado). */
export function HistoricoRegisto({
  chave,
  obter,
  nomesCampos,
}: {
  chave: unknown[]
  obter: () => Promise<EntradaHistorico[]>
  nomesCampos: Record<string, string>
}) {
  const { data, isLoading } = useQuery({ queryKey: chave, queryFn: obter })
  if (isLoading) return <p className="ajuda">A carregar…</p>
  if (!data?.length) return <p className="ajuda">Sem histórico.</p>
  return (
    <ol className="historico">
      {data.map((h, i) => (
        <li key={i}>
          <div className="historico-cabecalho">
            <strong>{h.tipo[0].toUpperCase() + h.tipo.slice(1)}</strong> · {momentoPt(h.momento)}
            {h.utilizador && ` · ${h.utilizador}`}
          </div>
          {h.alteracoes.length > 0 && (
            <ul>
              {h.alteracoes.map((a) => (
                <li key={a.campo}>
                  {nomesCampos[a.campo] ?? a.campo}: <s>{a.antes || '—'}</s> → {a.depois || '—'}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}
