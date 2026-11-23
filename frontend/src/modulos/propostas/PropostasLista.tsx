import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { formatarEuros } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { ETIQUETA_PROPOSTA, propostasApi } from './api'

const SEPARADORES: [string, string][] = [
  ['negociacao', 'Em negociação'],
  ['aceite', 'Aceites'],
  ['', 'Todas'],
]

export function PropostasLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const categoria = params.get('categoria') ?? 'negociacao'
  const pedidoLista: Record<string, string> = { ...consulta, categoria }
  if (categoria === 'todas') delete pedidoLista.categoria
  const opcoes = useQuery({ queryKey: ['propostas', 'opcoes'], queryFn: propostasApi.opcoes, staleTime: 60_000 })
  const lista = useQuery({
    queryKey: ['propostas', 'lista', pedidoLista],
    queryFn: () => propostasApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="pagina-lista">
      <div className="separadores" role="tablist">
        {SEPARADORES.map(([v, n]) => (
          <button
            key={n}
            role="tab"
            aria-selected={categoria === (v || 'todas')}
            className={categoria === (v || 'todas') ? 'ativo' : ''}
            onClick={() => mudar({ categoria: v === 'negociacao' ? '' : v || 'todas', page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar propostas"
          placeholder="Pesquisar por referência, comprador, imóvel ou localidade"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <select
          aria-label="Estado"
          value={params.get('estado') ?? ''}
          onChange={(e) => mudar({ estado: e.target.value, page: '' })}
        >
          <option value="">Todos os estados</option>
          {opcoes.data?.estados.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        {opcoes.data?.pode_criar && (
          <Link to="/propostas/nova" className="botao-principal">
            + Nova proposta
          </Link>
        )}
      </div>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma proposta encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Comprador</th>
              <th>Imóvel</th>
              <th>Valor atual</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/propostas/${x.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/propostas/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {x.referencia}
                  </Link>
                </td>
                <td data-rotulo="Comprador" className="celula-principal">
                  {x.entidade_nome ?? '—'}
                </td>
                <td data-rotulo="Imóvel">{x.imovel_descricao_completa}</td>
                <td data-rotulo="Valor atual">
                  {formatarEuros(x.valor_atual) ?? '—'}
                  {x.ultima_ronda_autor && <small className="ajuda"> · {x.ultima_ronda_autor}</small>}
                </td>
                <td data-rotulo="Estado">
                  {x.estado_nome && (
                    <span className={`etiqueta etiqueta-${ETIQUETA_PROPOSTA[x.estado_categoria ?? ''] ?? 'neutra'}`}>
                      {x.estado_nome}
                    </span>
                  )}
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
