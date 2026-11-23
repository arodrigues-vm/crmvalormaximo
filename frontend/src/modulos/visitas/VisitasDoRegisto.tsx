import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { dataPt } from '../../componentes/formatar'
import { ETIQUETA_VISITA, hora, interessesApi, visitasApi } from './api'

/** Visitas e interesses de um imóvel ou de uma entidade (para as fichas). */
export function VisitasDoRegisto({
  filtro,
  podeCriar,
}: {
  filtro: { imovel?: number; entidade?: number }
  podeCriar: boolean
}) {
  const params = Object.fromEntries(Object.entries(filtro).map(([k, v]) => [k, String(v)]))
  const visitas = useQuery({ queryKey: ['visitas', 'lista', params], queryFn: () => visitasApi.listar(params) })
  const interesses = useQuery({
    queryKey: ['interesses', 'lista', params],
    queryFn: () => interessesApi.listar(params),
  })
  const sufixo = new URLSearchParams(params).toString()
  const doImovel = filtro.imovel !== undefined

  return (
    <div className="relacoes">
      <h4 className="subtitulo-bloco">Visitas</h4>
      {visitas.data?.count === 0 && <p className="ajuda">Sem visitas registadas.</p>}
      <ul className="lista-relacoes">
        {visitas.data?.results.slice(0, 10).map((v) => (
          <li key={v.id}>
            <Link to={`/visitas/${v.id}`}>
              {dataPt(v.data)}
              {v.hora_entrada && ` ${hora(v.hora_entrada)}`}
            </Link>
            <span className="ajuda">
              {doImovel ? (v.entidade_nome ?? 'Entidade a que não tem acesso') : v.imovel_descricao}
            </span>
            <span className={`etiqueta etiqueta-${ETIQUETA_VISITA[v.estado_categoria ?? ''] ?? 'neutra'}`}>
              {v.estado_nome}
            </span>
          </li>
        ))}
      </ul>
      <h4 className="subtitulo-bloco">Interessados</h4>
      {interesses.data?.count === 0 && <p className="ajuda">Sem interesses registados.</p>}
      <ul className="lista-relacoes">
        {interesses.data?.results.slice(0, 10).map((i) => (
          <li key={i.id}>
            <Link to={`/visitas/interesses/${i.id}`}>
              {doImovel ? (i.entidade_nome ?? 'Entidade a que não tem acesso') : i.imovel_descricao}
            </Link>
            {i.grau_nome && <span className="ajuda">Grau: {i.grau_nome}</span>}
            <span className={`etiqueta etiqueta-${ETIQUETA_VISITA[i.estado_categoria ?? ''] ?? 'neutra'}`}>
              {i.estado_nome}
            </span>
          </li>
        ))}
      </ul>
      {podeCriar && (
        <div className="acoes-bloco">
          <Link to={`/visitas/nova?${sufixo}`} className="botao-secundario">
            + Agendar visita
          </Link>
          <Link to={`/visitas/interesses/novo?${sufixo}`} className="botao-secundario">
            + Registar interesse
          </Link>
        </div>
      )}
    </div>
  )
}
