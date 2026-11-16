import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { oportunidadesApi } from '../oportunidades/api'
import { procurasApi } from '../procuras/api'

/** Oportunidades (como proprietário) e procuras (como interessado) desta entidade. */
export function NegociosDaEntidade({
  entidadeId,
  podeOport,
  podeProc,
}: {
  entidadeId: number
  podeOport: boolean
  podeProc: boolean
}) {
  const op = useQuery({
    queryKey: ['oportunidades', 'lista', { entidade: String(entidadeId) }],
    queryFn: () => oportunidadesApi.listar({ entidade: String(entidadeId) }),
    enabled: podeOport,
  })
  const pr = useQuery({
    queryKey: ['procuras', 'lista', { entidade: String(entidadeId) }],
    queryFn: () => procurasApi.listar({ entidade: String(entidadeId) }),
    enabled: podeProc,
  })
  return (
    <div className="grelha-dados">
      {podeOport && (
        <div className="dado">
          <dt>Oportunidades de angariação</dt>
          <dd>
            {op.data?.results.length ? (
              <ul className="lista-relacoes">
                {op.data.results.map((o) => (
                  <li key={o.id}>
                    <Link to={`/oportunidades/${o.id}`}>{o.referencia}</Link>{' '}
                    <small className="ajuda">
                      {o.imovel_descricao} · {o.estado_nome}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="vazio">—</span>
            )}
            <Link to={`/oportunidades/nova?entidade=${entidadeId}`} className="ligacao-secundaria">
              + Nova oportunidade
            </Link>
          </dd>
        </div>
      )}
      {podeProc && (
        <div className="dado">
          <dt>Procuras</dt>
          <dd>
            {pr.data?.results.length ? (
              <ul className="lista-relacoes">
                {pr.data.results.map((p) => (
                  <li key={p.id}>
                    <Link to={`/procuras/${p.id}`}>{p.referencia}</Link>{' '}
                    <small className="ajuda">
                      {p.pretende_nome} · {p.estado_nome}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="vazio">—</span>
            )}
            <Link to={`/procuras/nova?entidade=${entidadeId}`} className="ligacao-secundaria">
              + Nova procura
            </Link>
          </dd>
        </div>
      )}
    </div>
  )
}
