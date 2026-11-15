import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { formatarEuros } from '../../componentes/formatar'
import { procurasApi } from '../procuras/api'
import { ListaCriterios } from '../procuras/Correspondencias'

/** Procuras ativas com as quais este imóvel é compatível (motor de correspondências). */
export function ProcurasCompativeis({ imovelId, versao }: { imovelId: number; versao: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['imoveis', imovelId, 'procuras', versao],
    queryFn: () => procurasApi.doImovel(imovelId),
  })
  if (isLoading) return <p className="ajuda">A procurar…</p>
  if (!data?.length) return <p className="ajuda">Nenhuma procura ativa é compatível com este imóvel.</p>
  return (
    <ol className="correspondencias">
      {data.map((r) => (
        <li key={r.procura.id}>
          <div className="correspondencia-corpo">
            <div className="correspondencia-titulo">
              <Link to={`/procuras/${r.procura.id}`}>
                <strong>{r.procura.referencia}</strong> · {r.procura.entidade ?? 'Interessado a que não tem acesso'}
              </Link>
              <span>{r.procura.orcamento_max ? `Orçamento ${formatarEuros(r.procura.orcamento_max)}` : ''}</span>
            </div>
            <ListaCriterios criterios={r.criterios} />
          </div>
        </li>
      ))}
    </ol>
  )
}
