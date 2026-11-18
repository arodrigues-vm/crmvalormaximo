import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { dataPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { urlFotografia } from '../imoveis/api'
import { cmiApi, ETIQUETA_ESTADO, textoTempo } from './api'

const FILTROS: [string, string][] = [
  ['', 'Todos'],
  ['por_assinar', 'Por assinar'],
  ['vigentes', 'Em vigor'],
  ['a_expirar', 'A expirar'],
  ['expiradas', 'Expirados'],
  ['concluidas', 'Concluídos'],
  ['canceladas', 'Cancelados'],
]

export function AngariacoesLista() {
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const [termo, setTermo] = useState(params.get('pesquisa') ?? '')
  const pagina = Number(params.get('page') ?? '1')

  function mudar(novos: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('pesquisa') ?? '') !== termo) mudar({ pesquisa: termo, page: '' })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo])

  const opcoes = useQuery({ queryKey: ['angariacoes', 'opcoes'], queryFn: cmiApi.opcoes, staleTime: 60_000 })
  const consulta = Object.fromEntries(params.entries())
  const lista = useQuery({
    queryKey: ['angariacoes', 'lista', consulta],
    queryFn: () => cmiApi.listar(consulta),
    placeholderData: keepPreviousData,
  })
  const estado = params.get('estado') ?? ''

  return (
    <div className="pagina-lista">
      <div className="separadores" role="tablist" aria-label="Estado">
        {FILTROS.map(([valor, nome]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={estado === valor}
            className={estado === valor ? 'ativo' : ''}
            onClick={() => mudar({ estado: valor, page: '' })}
          >
            {nome}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          placeholder="Pesquisar por referência, n.º de contrato, imóvel, localidade ou parte"
          aria-label="Pesquisar angariações"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <select
          aria-label="Ordenar"
          value={params.get('ordenar') ?? 'recentes'}
          onChange={(e) => mudar({ ordenar: e.target.value === 'recentes' ? '' : e.target.value })}
        >
          <option value="recentes">Mais recentes</option>
          <option value="fim">Data de fim (mais próxima)</option>
          <option value="referencia">Referência</option>
        </select>
        {opcoes.data?.pode_criar && (
          <Link to="/angariacoes/nova" className="botao-principal">
            + Nova angariação
          </Link>
        )}
      </div>

      {lista.isError && <p className="erro">Não foi possível carregar as angariações.</p>}
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma angariação encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th aria-label="Fotografia do imóvel" />
              <th>Referência</th>
              <th>Imóvel</th>
              <th>Partes</th>
              <th>Regime</th>
              <th>Vigência</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((a) => (
              <tr key={a.id} onClick={() => navegar(`/angariacoes/${a.id}`)}>
                <td className="celula-miniatura">
                  {a.imovel_fotografia ? (
                    <img
                      src={urlFotografia(a.imovel_fotografia.imovel, a.imovel_fotografia.versao, true)}
                      alt=""
                      loading="lazy"
                      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                    />
                  ) : (
                    <span className="miniatura-vazia" aria-hidden="true" />
                  )}
                </td>
                <td data-rotulo="Referência">
                  <Link to={`/angariacoes/${a.id}`} onClick={(e) => e.stopPropagation()}>
                    {a.referencia}
                  </Link>
                  {a.numero_contrato && <small className="ajuda"> n.º {a.numero_contrato}</small>}
                </td>
                <td data-rotulo="Imóvel" className="celula-principal">
                  {a.imovel_referencia}
                  <small className="ajuda"> {a.imovel_descricao}</small>
                </td>
                <td data-rotulo="Partes">{a.partes.join(', ') || '—'}</td>
                <td data-rotulo="Regime">{[a.regime_nome, a.operacao_nome].filter(Boolean).join(' · ') || '—'}</td>
                <td data-rotulo="Vigência">
                  {a.data_inicio ? `${dataPt(a.data_inicio)} – ${dataPt(a.data_fim_vigente)}` : '—'}
                </td>
                <td data-rotulo="Estado">
                  <span className={`etiqueta etiqueta-${ETIQUETA_ESTADO[a.estado]}`}>{a.estado_nome}</span>
                  {a.tempo_restante && (
                    <span className={`etiqueta etiqueta-tempo-${a.tempo_restante.cor}`}>
                      {textoTempo(a.tempo_restante)}
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
