import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { dataPt } from '../../componentes/formatar'
import { cmiApi, ETIQUETA_ESTADO, textoAlerta } from '../angariacoes/api'

export function AngariacoesDoImovel({ imovelId, podeCriar }: { imovelId: number; podeCriar: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['imoveis', imovelId, 'angariacoes'],
    queryFn: () => cmiApi.doImovel(imovelId),
  })
  if (isLoading) return <p className="ajuda">A carregar…</p>
  return (
    <>
      {data && data.angariacoes.length === 0 && data.outros === 0 && <p className="ajuda">Sem angariações.</p>}
      {data && data.angariacoes.length > 0 && (
        <ul className="lista-relacoes">
          {data.angariacoes.map((a) => (
            <li key={a.id}>
              <Link to={`/angariacoes/${a.id}`}>{a.referencia}</Link>
              <span className={`etiqueta etiqueta-${ETIQUETA_ESTADO[a.estado]}`}>{a.estado_nome}</span>
              <small className="ajuda">
                {[a.regime, a.data_inicio && `${dataPt(a.data_inicio)} – ${dataPt(a.data_fim_vigente)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
              {a.alerta && <span className="etiqueta etiqueta-perigo">{textoAlerta(a.alerta)}</span>}
            </li>
          ))}
        </ul>
      )}
      {data && data.outros > 0 && <p className="ajuda">E ainda {data.outros} angariação(ões) a que não tem acesso.</p>}
      {podeCriar && (
        <Link to={`/angariacoes/nova?imovel=${imovelId}`} className="botao-secundario">
          + Nova angariação para este imóvel
        </Link>
      )}
    </>
  )
}
