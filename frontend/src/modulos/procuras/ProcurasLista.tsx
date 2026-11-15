import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { formatarEuros } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { ETIQUETA_CATEGORIA } from '../oportunidades/api'
import { procurasApi } from './api'

const SEPARADORES: [string, string][] = [
  ['', 'Todas'],
  ['ativa', 'Ativas'],
  ['inativa', 'Inativas'],
]

export function ProcurasLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const opcoes = useQuery({ queryKey: ['procuras', 'opcoes'], queryFn: procurasApi.opcoes, staleTime: 60_000 })
  const lista = useQuery({
    queryKey: ['procuras', 'lista', consulta],
    queryFn: () => procurasApi.listar(consulta),
    placeholderData: keepPreviousData,
  })
  const categoria = params.get('categoria') ?? ''
  const o = opcoes.data
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
          aria-label="Pesquisar procuras"
          placeholder="Pesquisar por referência, interessado ou observações"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <select
          aria-label="Operação"
          value={params.get('operacao') ?? ''}
          onChange={(e) => mudar({ operacao: e.target.value, page: '' })}
        >
          <option value="">Todas as operações</option>
          {o?.operacoes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Urgência"
          value={params.get('urgencia') ?? ''}
          onChange={(e) => mudar({ urgencia: e.target.value, page: '' })}
        >
          <option value="">Todas as urgências</option>
          {o?.urgencias.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        {o?.pode_criar && (
          <Link to="/procuras/nova" className="botao-principal">
            + Nova procura
          </Link>
        )}
      </div>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma procura encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Interessado</th>
              <th>Procura</th>
              <th>Orçamento</th>
              <th>Urgência</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((p) => (
              <tr key={p.id} onClick={() => navegar(`/procuras/${p.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/procuras/${p.id}`} onClick={(e) => e.stopPropagation()}>
                    {p.referencia}
                  </Link>
                </td>
                <td data-rotulo="Interessado" className="celula-principal">
                  {p.entidade_nome ?? '—'}
                </td>
                <td data-rotulo="Procura">
                  {p.operacao_nome}
                  {p.resumo && <small className="ajuda"> · {p.resumo}</small>}
                </td>
                <td data-rotulo="Orçamento">
                  {formatarEuros(p.orcamento_max) ?? '—'}
                  {Number(p.tolerancia_pct) > 0 && <small className="ajuda"> (+{Number(p.tolerancia_pct)}%)</small>}
                </td>
                <td data-rotulo="Urgência">{p.urgencia_nome ?? '—'}</td>
                <td data-rotulo="Estado">
                  {p.estado_nome && (
                    <span className={`etiqueta etiqueta-${ETIQUETA_CATEGORIA[p.estado_categoria ?? ''] ?? 'neutra'}`}>
                      {p.estado_nome}
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
          aoMudar={(x) => mudar({ page: x > 1 ? String(x) : '' })}
        />
      )}
    </div>
  )
}
