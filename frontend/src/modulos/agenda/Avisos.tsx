import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { agendaApi, NOMES_ORIGEM } from './api'
import { momentoPt } from '../../componentes/formatar'

/** Sino de avisos internos (D-51): compromissos, visitas e tarefas que se aproximam. */
export function Avisos() {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const { data = [] } = useQuery({
    queryKey: ['agenda', 'avisos'],
    queryFn: agendaApi.avisos,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })
  const dispensar = useMutation({
    mutationFn: agendaApi.dispensar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', 'avisos'] }),
  })
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])
  return (
    <div className="avisos" ref={caixa}>
      <button
        className="botao-secundario avisos-botao"
        aria-label={`Avisos (${data.length})`}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <span aria-hidden>🔔</span>
        {data.length > 0 && <span className="avisos-numero">{data.length}</span>}
      </button>
      {aberto && (
        <div className="avisos-painel" role="dialog" aria-label="Avisos">
          {data.length === 0 && <p className="ajuda">Sem avisos.</p>}
          <ul>
            {data.map((a) => (
              <li key={a.chave}>
                <Link to={a.caminho} onClick={() => setAberto(false)}>
                  <strong>{a.titulo}</strong>
                  <small className="ajuda">
                    {NOMES_ORIGEM[a.origem]} · {a.momento ? momentoPt(a.momento) : 'prazo hoje'}
                  </small>
                </Link>
                <button
                  className="botao-icone"
                  aria-label={`Dispensar aviso ${a.titulo}`}
                  onClick={() => dispensar.mutate(a.chave)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <Link to="/agenda" className="ligacao-botao" onClick={() => setAberto(false)}>
            Abrir a Agenda
          </Link>
        </div>
      )}
    </div>
  )
}
