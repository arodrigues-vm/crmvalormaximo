import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { formatarPercentagem } from '../../componentes/formatar'
import { imoveisApi, tituloImovel } from '../imoveis/api'

/** Imóveis de que a entidade é proprietária (titularidade atual). */
export function ImoveisDaEntidade({ entidadeId }: { entidadeId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['entidades', entidadeId, 'imoveis'],
    queryFn: () => imoveisApi.daEntidade(entidadeId),
  })
  if (isLoading) return <p className="ajuda">A carregar…</p>
  if (!data || (data.imoveis.length === 0 && data.outros === 0))
    return <p className="ajuda">Não é proprietária de nenhum imóvel registado.</p>
  return (
    <>
      <ul className="lista-relacoes">
        {data.imoveis.map((i) => (
          <li key={i.id}>
            <Link to={`/imoveis/${i.id}`}>
              {i.referencia} · {tituloImovel(i)}
            </Link>
            <span className="relacao-tipo">{formatarPercentagem(i.quota) ?? 'Quota não indicada'}</span>
            <small className="ajuda">
              {[i.estado_comercializacao, i.status_categoria !== 'ativo' ? i.status : null].filter(Boolean).join(' · ')}
            </small>
          </li>
        ))}
      </ul>
      {data.outros > 0 && (
        <p className="ajuda">
          E ainda {data.outros} imóve{data.outros > 1 ? 'is' : 'l'} a que não tem acesso.
        </p>
      )}
    </>
  )
}
