import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { dataPt, formatarEuros } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { ETIQUETA_TRANSACAO, transacoesApi } from './api'

const SEPARADORES: [string, string][] = [
  ['em_curso', 'Em curso'],
  ['concluida', 'Concluídas'],
  ['cancelada', 'Canceladas'],
  ['', 'Todas'],
]

export function TransacoesLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const categoria = params.get('categoria') ?? 'em_curso'
  const pedidoLista: Record<string, string> = { ...consulta, categoria }
  if (categoria === 'todas') delete pedidoLista.categoria
  const lista = useQuery({
    queryKey: ['transacoes', 'lista', pedidoLista],
    queryFn: () => transacoesApi.listar(pedidoLista),
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
            onClick={() => mudar({ categoria: v === 'em_curso' ? '' : v || 'todas', page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar transações"
          placeholder="Pesquisar por referência, comprador, imóvel, localidade ou proposta"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>
      <p className="ajuda">
        Uma transação gera-se a partir de uma proposta aceite: abra a proposta e carregue em «Gerar Transação».
      </p>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma transação encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Comprador</th>
              <th>Imóvel</th>
              <th>Valor</th>
              <th>Escritura / contrato</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/transacoes/${x.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/transacoes/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {x.referencia}
                  </Link>
                </td>
                <td data-rotulo="Comprador" className="celula-principal">
                  {x.entidade_nome ?? '—'}
                </td>
                <td data-rotulo="Imóvel">
                  {x.imovel_descricao_completa}
                  {x.operacao_nome && <small className="ajuda"> · {x.operacao_nome}</small>}
                </td>
                <td data-rotulo="Valor">{formatarEuros(x.valor)}</td>
                <td data-rotulo="Escritura / contrato">
                  {x.data_escritura
                    ? dataPt(x.data_escritura)
                    : x.data_escritura_prevista
                      ? `Prevista: ${dataPt(x.data_escritura_prevista)}`
                      : '—'}
                </td>
                <td data-rotulo="Estado">
                  {x.estado_nome && (
                    <span className={`etiqueta etiqueta-${ETIQUETA_TRANSACAO[x.estado_categoria ?? ''] ?? 'neutra'}`}>
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
