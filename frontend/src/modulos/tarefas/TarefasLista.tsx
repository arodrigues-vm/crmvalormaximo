import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { dataPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { ETIQUETA_TAREFA, tarefasApi } from './api'

const SEPARADORES: [string, string][] = [
  ['abertas', 'Por fazer'],
  ['atrasadas', 'Atrasadas'],
  ['concluidas', 'Concluídas'],
  ['todas', 'Todas'],
]

/** Pós-Venda (F3-09, D-50): tarefas de acompanhamento depois da escritura / contrato. */
export function TarefasLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const vista = params.get('vista') || 'abertas'
  const pedidoLista: Record<string, string> = { ...consulta, vista, tipo: 'pos_venda' }
  const lista = useQuery({
    queryKey: ['tarefas', 'lista', pedidoLista],
    queryFn: () => tarefasApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
  })
  const opcoes = useQuery({ queryKey: ['tarefas', 'opcoes'], queryFn: tarefasApi.opcoes, staleTime: 60_000 })
  return (
    <div className="pagina-lista">
      <div className="separadores" role="tablist">
        {SEPARADORES.map(([v, n]) => (
          <button
            key={v}
            role="tab"
            aria-selected={vista === v}
            className={vista === v ? 'ativo' : ''}
            onClick={() => mudar({ vista: v === 'abertas' ? '' : v, page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar tarefas"
          placeholder="Pesquisar por referência, título, transação ou cliente"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        {opcoes.data?.pode_criar_pos_venda && (
          <Link to="/pos-venda/nova" className="botao-principal">
            Nova tarefa
          </Link>
        )}
      </div>
      <p className="ajuda">
        As tarefas de pós-venda nascem quando uma transação fica «Concluída» (a partir dos modelos de tarefa) ou
        acrescentam-se na ficha da transação.
      </p>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma tarefa encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Tarefa</th>
              <th>Cliente</th>
              <th>Transação</th>
              <th>Prazo</th>
              <th>Responsável</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/pos-venda/${x.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/pos-venda/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {x.referencia}
                  </Link>
                </td>
                <td data-rotulo="Tarefa" className="celula-principal">
                  {x.titulo}
                </td>
                <td data-rotulo="Cliente">{x.cliente_nome ?? '—'}</td>
                <td data-rotulo="Transação">{x.transacao_referencia}</td>
                <td data-rotulo="Prazo">
                  {x.prazo ? dataPt(x.prazo) : '—'}
                  {x.atrasada && <span className="etiqueta etiqueta-perigo"> Atrasada</span>}
                </td>
                <td data-rotulo="Responsável">{x.responsavel_nome}</td>
                <td data-rotulo="Estado">
                  {x.estado_nome && (
                    <span className={`etiqueta etiqueta-${ETIQUETA_TAREFA[x.estado_categoria ?? ''] ?? 'neutra'}`}>
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
