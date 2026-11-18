import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { formatarTelefone } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { entidadesApi } from './api'

const POR_PAGINA = 25

export function EntidadesLista() {
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const [termo, setTermo] = useState(params.get('pesquisa') ?? '')
  const pagina = Number(params.get('page') ?? '1')

  // Pesquisa com atraso, para não fazer um pedido por tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('pesquisa') ?? '') !== termo) mudar({ pesquisa: termo, page: '' })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo])

  function mudar(novos: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: true })
  }

  const opcoes = useQuery({ queryKey: ['entidades', 'opcoes'], queryFn: entidadesApi.opcoes, staleTime: 60_000 })
  const consulta = Object.fromEntries(params.entries())
  const lista = useQuery({
    queryKey: ['entidades', 'lista', consulta],
    queryFn: () => entidadesApi.listar(consulta),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="pagina-lista">
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          placeholder="Pesquisar por nome, NIF, email, telefone ou referência"
          aria-label="Pesquisar entidades"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <select
          aria-label="Tipo de cliente"
          value={params.get('papel') ?? ''}
          onChange={(e) => mudar({ papel: e.target.value, page: '' })}
        >
          <option value="">Todos os tipos de cliente</option>
          {opcoes.data?.papeis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo de pessoa"
          value={params.get('tipo_pessoa') ?? ''}
          onChange={(e) => mudar({ tipo_pessoa: e.target.value, page: '' })}
        >
          <option value="">Singulares e coletivas</option>
          {opcoes.data?.tipos_pessoa.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={params.get('status') ?? ''}
          onChange={(e) => mudar({ status: e.target.value, page: '' })}
        >
          <option value="">Todos os status</option>
          {opcoes.data?.status.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Ordenar"
          value={params.get('ordenar') ?? 'nome'}
          onChange={(e) => mudar({ ordenar: e.target.value === 'nome' ? '' : e.target.value })}
        >
          <option value="nome">Nome (A–Z)</option>
          <option value="-nome">Nome (Z–A)</option>
          <option value="recentes">Mais recentes</option>
          <option value="referencia">Referência</option>
        </select>
        {opcoes.data?.pode_criar && (
          <Link to="/entidades/nova" className="botao-principal">
            + Nova entidade
          </Link>
        )}
      </div>

      {lista.isError && <p className="erro">Não foi possível carregar as entidades.</p>}
      {lista.data && lista.data.count === 0 && (
        <p className="vazio-lista">
          {params.toString() ? 'Nenhuma entidade corresponde à pesquisa.' : 'Ainda não há entidades.'}
        </p>
      )}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Nome</th>
              <th>NIF</th>
              <th>Contacto</th>
              <th>Tipo de cliente</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((e) => (
              <tr
                key={e.id}
                onClick={() => navegar(`/entidades/${e.id}`)}
                className={e.status_categoria === 'inativo' ? 'inativa' : ''}
              >
                <td data-rotulo="Referência">
                  <Link to={`/entidades/${e.id}`} onClick={(ev) => ev.stopPropagation()}>
                    {e.referencia}
                  </Link>
                </td>
                <td data-rotulo="Nome" className="celula-principal">
                  {e.nome_completo}
                  {e.status_nome && e.status_categoria !== 'ativo' && (
                    <span className="etiqueta etiqueta-neutra">{e.status_nome}</span>
                  )}
                </td>
                <td data-rotulo="NIF">{e.nif || '—'}</td>
                <td data-rotulo="Contacto">
                  {e.telefone_principal ? formatarTelefone(e.telefone_principal) : e.email || '—'}
                </td>
                <td data-rotulo="Tipo de cliente">{e.papeis_nomes.join(', ') || '—'}</td>
                <td data-rotulo="Responsável">{e.responsavel_nome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lista.data && (
        <Paginacao
          pagina={pagina}
          total={lista.data.count}
          porPagina={POR_PAGINA}
          aoMudar={(p) => mudar({ page: p > 1 ? String(p) : '' })}
        />
      )}
    </div>
  )
}
