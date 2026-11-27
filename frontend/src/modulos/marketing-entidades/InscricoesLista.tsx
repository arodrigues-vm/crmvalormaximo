import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Dialogo } from '../../componentes/Dialogo'
import { dataPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { inscricoesApi, planosEntidadesApi, type PlanoEntidades } from './api'

/** Marketing de Entidades (F4-05, D-55): entidades nos planos, por plano e estado. */
export function InscricoesLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const { pode } = useSessao()
  const [aIniciar, setAIniciar] = useState<PlanoEntidades | null>(null)
  const estado = params.get('estado') ?? 'ativa'
  const pedidoLista: Record<string, string> = { ...consulta, estado }
  if (estado === 'todas') delete pedidoLista.estado
  const lista = useQuery({
    queryKey: ['inscricoes-marketing', 'lista', pedidoLista],
    queryFn: () => inscricoesApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
  })
  const planos = useQuery({ queryKey: ['planos-entidades'], queryFn: planosEntidadesApi.listar })
  const ativos = (planos.data ?? []).filter((p) => p.ativo)
  return (
    <div className="pagina-lista">
      <div className="separadores" role="tablist">
        {[
          ['ativa', 'Ativas'],
          ['terminada', 'Terminadas'],
          ['todas', 'Todas'],
        ].map(([v, n]) => (
          <button
            key={v}
            role="tab"
            aria-selected={estado === v}
            className={estado === v ? 'ativo' : ''}
            onClick={() => mudar({ estado: v === 'ativa' ? '' : v, page: '' })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar por entidade"
          placeholder="Pesquisar por nome da entidade"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <label className="campo-compacto">
          <span>Plano</span>
          <select
            aria-label="Plano"
            value={params.get('plano') ?? ''}
            onChange={(e) => mudar({ plano: e.target.value, page: '' })}
          >
            <option value="">Todos</option>
            {(planos.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {planos.data?.length === 0 && (
        <p className="aviso">
          Ainda não há planos de marketing de entidades. O Administrador cria-os em Configurações → Marketing de
          Entidades.
        </p>
      )}
      {ativos.length > 0 && pode('marketing-entidades', 'criar') && (
        <p className="ajuda">
          Iniciar um plano para todo o seu público:{' '}
          {ativos.map((p) => (
            <button key={p.id} type="button" className="ligacao-botao" onClick={() => setAIniciar(p)}>
              {p.nome}
            </button>
          ))}
        </p>
      )}
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhuma entidade encontrada.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Entidade</th>
              <th>Plano</th>
              <th>Início</th>
              <th>Tarefas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(`/marketing-entidades/${x.id}`)}>
                <td data-rotulo="Referência">
                  <Link to={`/marketing-entidades/${x.id}`} onClick={(e) => e.stopPropagation()}>
                    {x.referencia}
                  </Link>
                </td>
                <td data-rotulo="Entidade" className="celula-principal">
                  {x.entidade_nome}
                </td>
                <td data-rotulo="Plano">
                  {x.plano_nome}
                  <small className="ajuda"> · {x.origem_nome}</small>
                </td>
                <td data-rotulo="Início">{dataPt(x.inicio)}</td>
                <td data-rotulo="Tarefas">
                  {x.progresso.concluidas} concluídas · {x.progresso.por_fazer} por fazer
                </td>
                <td data-rotulo="Estado">
                  <span className={`etiqueta etiqueta-${x.estado === 'ativa' ? 'aviso' : 'neutra'}`}>
                    {x.estado === 'ativa' ? 'Ativa' : 'Terminada'}
                  </span>
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
      {aIniciar && <DialogoIniciar plano={aIniciar} aoFechar={() => setAIniciar(null)} />}
    </div>
  )
}

/** Pré-visualização do público (quantidade, RGPD) e confirmação expressa antes de inscrever. */
function DialogoIniciar({ plano, aoFechar }: { plano: PlanoEntidades; aoFechar: () => void }) {
  const qc = useQueryClient()
  const resumo = useQuery({
    queryKey: ['planos-entidades', plano.id, 'publico'],
    queryFn: () => planosEntidadesApi.publico(plano.id),
    gcTime: 0,
  })
  const iniciar = useMutation({
    mutationFn: () => planosEntidadesApi.iniciarPublico(plano.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inscricoes-marketing'] })
      qc.invalidateQueries({ queryKey: ['planos-entidades'] })
      qc.invalidateQueries({ queryKey: ['tarefas'] })
    },
  })
  const r = resumo.data
  return (
    <Dialogo
      titulo={`Iniciar «${plano.nome}» para o público`}
      aberto
      aoFechar={aoFechar}
      acoes={
        iniciar.data ? (
          <button className="botao-principal" onClick={aoFechar}>
            Fechar
          </button>
        ) : (
          <>
            <button className="botao-secundario" onClick={aoFechar}>
              Cancelar
            </button>
            <button
              className="botao-principal"
              disabled={!r || r.a_inscrever === 0 || iniciar.isPending}
              onClick={() => iniciar.mutate()}
            >
              Confirmar e iniciar
            </button>
          </>
        )
      }
    >
      {r && !iniciar.data && (
        <ul className="lista-resumo">
          <li>
            Entidades do público: <strong>{r.total}</strong>
          </li>
          <li>Excluídas por oposição a marketing: {r.oposicao}</li>
          <li>Excluídas por falta de consentimento: {r.sem_consentimento}</li>
          <li>Já estão no plano: {r.ja_inscritas}</li>
          <li>
            Vão entrar no plano: <strong>{r.a_inscrever}</strong> (só as que pode consultar)
          </li>
        </ul>
      )}
      {iniciar.data && <p>Entraram no plano {iniciar.data.inscritas} entidades; as tarefas foram criadas.</p>}
      {iniciar.error instanceof ErroApi && (
        <p className="erro" role="alert">
          {iniciar.error.message}
        </p>
      )}
    </Dialogo>
  )
}
