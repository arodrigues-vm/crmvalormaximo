import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { formatarEuros } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { comissoesApi } from './api'

const VISTAS: [string, string][] = [
  ['', 'Todas'],
  ['por_apurar', 'Por apurar'],
  ['excecoes', 'Exceções pendentes'],
]

const lados = (a: boolean, v: boolean) => [a && 'Angariação', v && 'Venda'].filter(Boolean).join(' + ') || '—'

/** Faturação e Comissões: lista das comissões apuradas a partir das transações (D-48). */
export function ComissoesLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const vista = params.get('vista') ?? ''
  const pedidoLista: Record<string, string> = { ...consulta, ...(vista ? { vista } : {}) }
  const lista = useQuery({
    queryKey: ['comissoes', 'lista', pedidoLista],
    queryFn: () => comissoesApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="pagina-lista">
      <div className="separadores" role="tablist">
        {VISTAS.map(([v, n]) => (
          <button
            key={n}
            role="tab"
            aria-selected={vista === v}
            className={vista === v ? 'ativo' : ''}
            onClick={() => mudar({ vista: v, page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar comissões"
          placeholder="Pesquisar por referência, transação, comprador, imóvel ou localidade"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>
      <p className="ajuda">
        As comissões apuram-se a partir das transações: abra a transação e carregue em «Apurar comissão».
      </p>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma comissão encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Transação</th>
              <th>Imóvel</th>
              <th>Comissão total</th>
              <th>Lados nossos</th>
              <th>Valor nosso</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/faturacao/comissoes/${x.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/faturacao/comissoes/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {x.referencia}
                  </Link>
                  {x.excecao_pendente && <span className="etiqueta etiqueta-aviso"> exceção pendente</span>}
                </td>
                <td data-rotulo="Transação">
                  {x.transacao_referencia}
                  {x.transacao_estado && <small className="ajuda"> · {x.transacao_estado}</small>}
                </td>
                <td data-rotulo="Imóvel" className="celula-principal">
                  {x.imovel_descricao}
                  {x.comprador_nome && <small className="ajuda"> · {x.comprador_nome}</small>}
                </td>
                <td data-rotulo="Comissão total">{formatarEuros(x.valor_final) ?? 'Por apurar'}</td>
                <td data-rotulo="Lados nossos">{lados(x.lado_angariacao_nosso, x.lado_venda_nosso)}</td>
                <td data-rotulo="Valor nosso">{formatarEuros(x.total_nosso) ?? '—'}</td>
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
