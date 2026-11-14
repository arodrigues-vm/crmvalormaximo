import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { formatarArea, formatarEuros } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { imoveisApi, STATUS_ETIQUETA } from './api'

export function ImoveisLista() {
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

  const opcoes = useQuery({ queryKey: ['imoveis', 'opcoes'], queryFn: imoveisApi.opcoes, staleTime: 60_000 })
  const consulta = Object.fromEntries(params.entries())
  const lista = useQuery({
    queryKey: ['imoveis', 'lista', consulta],
    queryFn: () => imoveisApi.listar(consulta),
    placeholderData: keepPreviousData,
  })
  const o = opcoes.data
  const filtro = (nome: string, rotulo: string, itens: { valor: string | number; nome: string }[], todos: string) => (
    <select
      aria-label={rotulo}
      value={params.get(nome) ?? ''}
      onChange={(e) => mudar({ [nome]: e.target.value, page: '' })}
    >
      <option value="">{todos}</option>
      {itens.map((i) => (
        <option key={i.valor} value={i.valor}>
          {i.nome}
        </option>
      ))}
    </select>
  )

  return (
    <div className="pagina-lista">
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          placeholder="Pesquisar por referência, morada, localidade ou proprietário"
          aria-label="Pesquisar imóveis"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        {filtro('operacao', 'Operação', o?.operacoes ?? [], 'Venda e arrendamento')}
        {filtro(
          'tipo',
          'Tipo',
          (o?.tipos ?? []).map((x) => ({ valor: x.id, nome: x.nome })),
          'Todos os tipos',
        )}
        {filtro(
          'tipologia',
          'Tipologia',
          (o?.tipologias ?? []).map((x) => ({ valor: x.id, nome: x.nome })),
          'Todas as tipologias',
        )}
        {filtro(
          'estado_comercializacao',
          'Estado de comercialização',
          (o?.estados_comercializacao ?? []).map((x) => ({ valor: x.id, nome: x.nome })),
          'Todos os estados',
        )}
        {filtro('status', 'Status', o?.status ?? [], 'Ativos e inativos')}
        <input
          type="number"
          min={0}
          step={1000}
          aria-label="Preço máximo"
          placeholder="Preço máx. (€)"
          value={params.get('preco_max') ?? ''}
          onChange={(e) => mudar({ preco_max: e.target.value, page: '' })}
          className="filtro-curto"
        />
        <select
          aria-label="Ordenar"
          value={params.get('ordenar') ?? 'recentes'}
          onChange={(e) => mudar({ ordenar: e.target.value === 'recentes' ? '' : e.target.value })}
        >
          <option value="recentes">Mais recentes</option>
          <option value="preco">Preço (crescente)</option>
          <option value="-preco">Preço (decrescente)</option>
          <option value="referencia">Referência</option>
        </select>
        {o?.pode_criar && (
          <Link to="/imoveis/novo" className="botao-principal">
            + Novo imóvel
          </Link>
        )}
      </div>

      {lista.isError && <p className="erro">Não foi possível carregar os imóveis.</p>}
      {lista.data?.count === 0 && (
        <p className="vazio-lista">
          {params.toString() ? 'Nenhum imóvel corresponde à pesquisa.' : 'Ainda não há imóveis.'}
        </p>
      )}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Imóvel</th>
              <th>Localização</th>
              <th>Preço</th>
              <th>Estado</th>
              <th>Proprietários</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((i) => (
              <tr key={i.id} onClick={() => navegar(`/imoveis/${i.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/imoveis/${i.id}`} onClick={(ev) => ev.stopPropagation()}>
                    {i.referencia}
                  </Link>
                </td>
                <td data-rotulo="Imóvel" className="celula-principal">
                  {[i.tipo_nome, i.tipologia_nome].filter(Boolean).join(' ') || '—'}
                  <small className="ajuda">
                    {' '}
                    {i.operacao === 'venda' ? 'Venda' : 'Arrendamento'}
                    {i.area_bruta_privativa && ` · ${formatarArea(i.area_bruta_privativa)}`}
                  </small>
                </td>
                <td data-rotulo="Localização">{[i.localidade, i.concelho].filter(Boolean).join(', ') || '—'}</td>
                <td data-rotulo="Preço">{formatarEuros(i.preco) ?? '—'}</td>
                <td data-rotulo="Estado">
                  {i.estado_comercializacao_nome ?? '—'}
                  {i.status !== 'ativo' && (
                    <span className={`etiqueta etiqueta-${STATUS_ETIQUETA[i.status]}`}>
                      {i.status === 'inativo' ? 'Inativo' : 'Arquivado'}
                    </span>
                  )}
                </td>
                <td data-rotulo="Proprietários">{i.proprietarios_nomes.join(', ') || '—'}</td>
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
