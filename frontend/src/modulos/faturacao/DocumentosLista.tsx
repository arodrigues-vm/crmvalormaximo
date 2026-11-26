import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { dataPt, formatarEuros } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { documentosApi } from './api'
import { NavegacaoFaturacao } from './NavegacaoFaturacao'

/** Documentos que os consultores emitem à agência e o que falta pagar (D-49). */
export function DocumentosLista() {
  const { mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const lista = useQuery({
    queryKey: ['documentos-consultor', 'lista', consulta],
    queryFn: () => documentosApi.listar(consulta),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="pagina-lista">
      <NavegacaoFaturacao />
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar documentos"
          placeholder="Pesquisar por referência, número, consultor, comissão ou transação"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>
      <p className="ajuda">
        Os documentos registam-se a partir da comissão: abra a comissão e, em «Pagamentos aos consultores», carregue em
        «Registar documento».
      </p>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhum documento registado.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Consultor</th>
              <th>Comissão</th>
              <th>Data</th>
              <th>A pagar</th>
              <th>Em falta</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((d) => (
              <tr key={d.id} onClick={() => navegar(`/faturacao/documentos/${d.id}`)}>
                <td data-rotulo="Documento">
                  <Link to={`/faturacao/documentos/${d.id}`} onClick={(e) => e.stopPropagation()}>
                    {d.tipo_nome} {[d.serie, d.numero].filter(Boolean).join('/')}
                  </Link>
                </td>
                <td data-rotulo="Consultor" className="celula-principal">
                  {d.consultor_nome}
                </td>
                <td data-rotulo="Comissão">
                  {d.comissao_referencia} <small className="ajuda">· {d.transacao_referencia}</small>
                </td>
                <td data-rotulo="Data">{dataPt(d.data_emissao)}</td>
                <td data-rotulo="A pagar">{formatarEuros(d.saldo.a_pagar)}</td>
                <td data-rotulo="Em falta">
                  {d.tipo_categoria === 'credito' ? '—' : formatarEuros(d.saldo.em_aberto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lista.data && (
        <Paginacao
          pagina={pagina}
          total={lista.data.count}
          porPagina={25}
          aoMudar={(p) => mudar({ page: p > 1 ? String(p) : '' })}
        />
      )}
    </div>
  )
}
