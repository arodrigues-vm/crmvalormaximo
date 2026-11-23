import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { dataPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { ETIQUETA_VISITA, hora, visitasApi } from './api'

const hojeIso = () => new Date().toLocaleDateString('sv-SE')

// Separadores: próximas (a partir de hoje, por ordem), realizadas e todas.
const SEPARADORES: [string, string][] = [
  ['proximas', 'Próximas'],
  ['realizada', 'Realizadas'],
  ['todas', 'Todas'],
]

export function NavegacaoVisitas({ atual }: { atual: 'visitas' | 'interesses' }) {
  return (
    <nav className="separadores" aria-label="Visitas e interesses">
      <Link to="/visitas" className={atual === 'visitas' ? 'ativo' : ''} aria-current={atual === 'visitas'}>
        Visitas
      </Link>
      <Link
        to="/visitas/interesses"
        className={atual === 'interesses' ? 'ativo' : ''}
        aria-current={atual === 'interesses'}
      >
        Interesses
      </Link>
    </nav>
  )
}

export function VisitasLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const vista = params.get('vista') ?? 'proximas'
  const pedidoLista: Record<string, string> = { ...consulta }
  delete pedidoLista.vista
  if (vista === 'proximas') Object.assign(pedidoLista, { desde: hojeIso(), ordem: 'proximas' })
  if (vista === 'realizada') pedidoLista.categoria = 'realizada'
  const opcoes = useQuery({ queryKey: ['visitas', 'opcoes'], queryFn: visitasApi.opcoes, staleTime: 60_000 })
  const lista = useQuery({
    queryKey: ['visitas', 'lista', pedidoLista],
    queryFn: () => visitasApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="pagina-lista">
      <NavegacaoVisitas atual="visitas" />
      <div className="separadores" role="tablist">
        {SEPARADORES.map(([v, n]) => (
          <button
            key={v}
            role="tab"
            aria-selected={vista === v}
            className={vista === v ? 'ativo' : ''}
            onClick={() => mudar({ vista: v === 'proximas' ? '' : v, page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar visitas"
          placeholder="Pesquisar por referência, cliente, imóvel ou localidade"
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
          <Link to="/visitas/nova" className="botao-principal">
            + Nova visita
          </Link>
        )}
      </div>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma visita encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Imóvel</th>
              <th>Consultor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/visitas/${x.id}`)}>
                <td data-rotulo="Data">
                  <Link to={`/visitas/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {dataPt(x.data)}
                  </Link>
                  {x.hora_entrada && <small className="ajuda"> {hora(x.hora_entrada)}</small>}
                </td>
                <td data-rotulo="Cliente" className="celula-principal">
                  {x.entidade_nome ?? '—'}
                </td>
                <td data-rotulo="Imóvel">{x.imovel_descricao}</td>
                <td data-rotulo="Consultor">{x.responsavel_nome}</td>
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
