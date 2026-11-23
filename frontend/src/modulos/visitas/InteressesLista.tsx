import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { dataPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { ETIQUETA_VISITA, interessesApi } from './api'
import { NavegacaoVisitas } from './VisitasLista'

const SEPARADORES: [string, string][] = [
  ['ativo', 'Em acompanhamento'],
  ['inativo', 'Encerrados'],
  ['', 'Todos'],
]

export function InteressesLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const categoria = params.get('categoria') ?? 'ativo'
  const pedidoLista: Record<string, string> = { ...consulta, categoria }
  if (categoria === 'todos') delete pedidoLista.categoria
  const opcoes = useQuery({ queryKey: ['interesses', 'opcoes'], queryFn: interessesApi.opcoes, staleTime: 60_000 })
  const lista = useQuery({
    queryKey: ['interesses', 'lista', pedidoLista],
    queryFn: () => interessesApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="pagina-lista">
      <NavegacaoVisitas atual="interesses" />
      <div className="separadores" role="tablist">
        {SEPARADORES.map(([v, n]) => (
          <button
            key={n}
            role="tab"
            aria-selected={categoria === (v || 'todos')}
            className={categoria === (v || 'todos') ? 'ativo' : ''}
            onClick={() => mudar({ categoria: v === 'ativo' ? '' : v || 'todos', page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar interesses"
          placeholder="Pesquisar por referência, cliente, imóvel ou localidade"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        {opcoes.data?.pode_criar && (
          <Link to="/visitas/interesses/novo" className="botao-principal">
            + Novo interesse
          </Link>
        )}
      </div>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhum interesse encontrado.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Imóvel</th>
              <th>Grau</th>
              <th>Última visita</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/visitas/interesses/${x.id}`)}>
                <td data-rotulo="Cliente" className="celula-principal">
                  <Link to={`/visitas/interesses/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {x.entidade_nome ?? 'Entidade a que não tem acesso'}
                  </Link>
                </td>
                <td data-rotulo="Imóvel">{x.imovel_descricao}</td>
                <td data-rotulo="Grau">{x.grau_nome ?? '—'}</td>
                <td data-rotulo="Última visita">{dataPt(x.ultima_visita) ?? '—'}</td>
                <td data-rotulo="Estado">
                  {x.estado_nome && (
                    <span className={`etiqueta etiqueta-${ETIQUETA_VISITA[x.estado_categoria ?? ''] ?? 'neutra'}`}>
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
