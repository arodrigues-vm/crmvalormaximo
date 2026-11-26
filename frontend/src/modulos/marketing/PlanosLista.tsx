import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { dataPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { planosApi } from './api'
import { Semanas } from './Semanas'

/** Planos de Marketing de Imóveis (F4-03, D-53). */
export function PlanosLista() {
  const { mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const lista = useQuery({
    queryKey: ['planos-marketing', 'lista', consulta],
    queryFn: () => planosApi.listar(consulta),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="pagina-lista">
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar planos"
          placeholder="Pesquisar por referência do plano, do imóvel ou do CMI, ou localidade"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>
      <p className="ajuda">
        O plano cria-se na ficha do CMI assinado, com «Criar plano inicial». Cores de cada semana: vermelho — nenhuma
        concluída; amarelo — em curso; verde — todas concluídas; cinzento — sem tarefas incluídas.
      </p>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhum plano encontrado.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Imóvel</th>
              <th>CMI</th>
              <th>Início</th>
              <th>Semanas</th>
              <th>Concluídas</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/marketing-imoveis/${x.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/marketing-imoveis/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {x.referencia}
                  </Link>
                </td>
                <td data-rotulo="Imóvel" className="celula-principal">
                  {x.imovel_descricao}
                </td>
                <td data-rotulo="CMI">{x.angariacao_referencia}</td>
                <td data-rotulo="Início">{dataPt(x.data_base)}</td>
                <td data-rotulo="Semanas">
                  <Semanas ind={x.indicadores} compacto />
                </td>
                <td data-rotulo="Concluídas">
                  {x.indicadores.concluidas} de {x.indicadores.incluidas}
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
