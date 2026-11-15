import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { dataPt, formatarEuros } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { ETIQUETA_CATEGORIA, oportunidadesApi } from './api'

const SEPARADORES: [string, string][] = [
  ['', 'Todas'],
  ['aberta', 'Em curso'],
  ['ganha', 'Angariadas'],
  ['perdida', 'Perdidas'],
]

export function OportunidadesLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const opcoes = useQuery({
    queryKey: ['oportunidades', 'opcoes'],
    queryFn: oportunidadesApi.opcoes,
    staleTime: 60_000,
  })
  const lista = useQuery({
    queryKey: ['oportunidades', 'lista', consulta],
    queryFn: () => oportunidadesApi.listar(consulta),
    placeholderData: keepPreviousData,
  })
  const categoria = params.get('categoria') ?? ''

  return (
    <div className="pagina-lista">
      <div className="separadores" role="tablist">
        {SEPARADORES.map(([v, n]) => (
          <button
            key={v}
            role="tab"
            aria-selected={categoria === v}
            className={categoria === v ? 'ativo' : ''}
            onClick={() => mudar({ categoria: v, page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar oportunidades"
          placeholder="Pesquisar por referência, proprietário, localidade ou imóvel"
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
        <select
          aria-label="Qualificação"
          value={params.get('qualificacao') ?? ''}
          onChange={(e) => mudar({ qualificacao: e.target.value, page: '' })}
        >
          <option value="">Qualificação inicial e completa</option>
          {opcoes.data?.qualificacoes.map((x) => (
            <option key={x.valor} value={x.valor}>
              {x.nome}
            </option>
          ))}
        </select>
        {opcoes.data?.pode_criar && (
          <Link to="/oportunidades/nova" className="botao-principal">
            + Nova oportunidade
          </Link>
        )}
      </div>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma oportunidade encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Proprietário</th>
              <th>Imóvel</th>
              <th>Preço pretendido</th>
              <th>Prazo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((o) => (
              <tr key={o.id} onClick={() => navegar(`/oportunidades/${o.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/oportunidades/${o.id}`} onClick={(e) => e.stopPropagation()}>
                    {o.referencia}
                  </Link>
                </td>
                <td data-rotulo="Proprietário" className="celula-principal">
                  {o.entidade_nome ?? '—'}
                </td>
                <td data-rotulo="Imóvel">
                  {o.imovel_descricao}
                  {o.operacao_nome && <small className="ajuda"> · {o.operacao_nome}</small>}
                </td>
                <td data-rotulo="Preço pretendido">{formatarEuros(o.preco_pretendido) ?? '—'}</td>
                <td data-rotulo="Prazo">{dataPt(o.prazo) ?? '—'}</td>
                <td data-rotulo="Estado">
                  {o.estado_nome && (
                    <span className={`etiqueta etiqueta-${ETIQUETA_CATEGORIA[o.estado_categoria ?? ''] ?? 'neutra'}`}>
                      {o.estado_nome}
                    </span>
                  )}
                  <small className="ajuda">
                    {' '}
                    {o.qualificacao === 'completa' ? 'Qualif. completa' : 'Qualif. inicial'}
                  </small>
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
