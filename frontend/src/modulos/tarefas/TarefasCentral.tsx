import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { CampoAreaTexto } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { dataPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { caminhoTarefa, ETIQUETA_TAREFA, pedeMotivo, tarefasApi, type TarefaResumo } from './api'

const VISTAS: [string, string][] = [
  ['lista', 'Lista'],
  ['cartoes', 'Cartões'],
  ['kanban', 'Quadro'],
]
const SEPARADORES: [string, string][] = [
  ['abertas', 'Por fazer'],
  ['atrasadas', 'Atrasadas'],
  ['concluidas', 'Concluídas'],
  ['todas', 'Todas'],
]
const TIPOS: [string, string][] = [
  ['', 'Todas'],
  ['geral', 'Gerais'],
  ['pos_venda', 'Pós-venda'],
]

/** Tarefas (F4-01, D-52): lista central das tarefas gerais e de pós-venda, em Lista, Cartões ou Quadro. */
export function TarefasCentral() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const modo = params.get('modo') || 'lista'
  const vista = params.get('vista') || 'abertas'
  const tipo = params.get('tipo') ?? ''
  const opcoes = useQuery({ queryKey: ['tarefas', 'opcoes'], queryFn: tarefasApi.opcoes, staleTime: 60_000 })
  const filtro: Record<string, string> = { ...consulta }
  delete filtro.modo
  if (!tipo) delete filtro.tipo
  const pedidoLista = { ...filtro, vista }
  const lista = useQuery({
    queryKey: ['tarefas', 'lista', pedidoLista],
    queryFn: () => tarefasApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
    enabled: modo !== 'kanban',
  })
  const pedidoQuadro = { ...filtro }
  delete pedidoQuadro.vista
  delete pedidoQuadro.page
  const quadro = useQuery({
    queryKey: ['tarefas', 'kanban', pedidoQuadro],
    queryFn: () => tarefasApi.kanban(pedidoQuadro),
    enabled: modo === 'kanban',
  })

  return (
    <div className="pagina-lista">
      <div className="barra-lista tarefas-barra">
        <div className="alternar-vista" role="group" aria-label="Vista">
          {VISTAS.map(([v, n]) => (
            <button
              key={v}
              aria-pressed={modo === v}
              className={modo === v ? 'botao-principal' : 'botao-secundario'}
              onClick={() => mudar({ modo: v === 'lista' ? '' : v, page: '' })}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="campo-compacto">
          <span>Tipo</span>
          <select aria-label="Tipo" value={tipo} onChange={(e) => mudar({ tipo: e.target.value, page: '' })}>
            {TIPOS.map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {opcoes.data?.pode_criar && (
          <Link to="/tarefas/nova" className="botao-principal">
            Nova tarefa
          </Link>
        )}
      </div>
      {modo !== 'kanban' && (
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
      )}
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar tarefas"
          placeholder="Pesquisar por referência, título, transação ou cliente"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>

      {modo === 'kanban' && (
        <Quadro tarefas={quadro.data ?? []} estados={opcoes.data?.estados ?? []} aCarregar={quadro.isLoading} />
      )}

      {modo !== 'kanban' && lista.data?.count === 0 && <p className="vazio-lista">Nenhuma tarefa encontrada.</p>}
      {modo === 'lista' && lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Referência</th>
              <th>Tarefa</th>
              <th>Ligada a</th>
              <th>Prazo</th>
              <th>Responsável</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((x) => (
              <tr key={x.id} onClick={() => navegar(caminhoTarefa(x))}>
                <td data-rotulo="Referência">
                  <Link to={caminhoTarefa(x)} onClick={(e) => e.stopPropagation()}>
                    {x.referencia}
                  </Link>
                </td>
                <td data-rotulo="Tarefa" className="celula-principal">
                  {x.titulo}
                </td>
                <td data-rotulo="Ligada a">{ligadaA(x)}</td>
                <td data-rotulo="Prazo">
                  {x.prazo ? dataPt(x.prazo) : '—'}
                  {x.atrasada && <span className="etiqueta etiqueta-perigo"> Atrasada</span>}
                </td>
                <td data-rotulo="Responsável">{x.responsavel_nome}</td>
                <td data-rotulo="Estado">
                  <EtiquetaEstado t={x} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modo === 'cartoes' && lista.data && lista.data.count > 0 && (
        <div className="cartoes-tarefas">
          {lista.data.results.map((x) => (
            <Cartao key={x.id} t={x} />
          ))}
        </div>
      )}
      {modo !== 'kanban' && lista.data && (
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

const ligadaA = (x: TarefaResumo) =>
  x.pos_venda ? `Pós-venda · ${x.transacao_referencia ?? ''}` : x.origem ? x.origem.titulo : '—'

function EtiquetaEstado({ t }: { t: TarefaResumo }) {
  return t.estado_nome ? (
    <span className={`etiqueta etiqueta-${ETIQUETA_TAREFA[t.estado_categoria ?? ''] ?? 'neutra'}`}>
      {t.estado_nome}
    </span>
  ) : null
}

function Cartao({ t, extra }: { t: TarefaResumo; extra?: React.ReactNode }) {
  return (
    <article className="cartao-tarefa">
      <Link to={caminhoTarefa(t)} className="cartao-titulo">
        {t.titulo}
      </Link>
      <p className="ajuda">{ligadaA(t)}</p>
      <p className="cartao-rodape">
        <span>{t.prazo ? dataPt(t.prazo) : 'Sem prazo'}</span>
        {t.atrasada && <span className="etiqueta etiqueta-perigo">Atrasada</span>}
        <span className="ajuda">{t.responsavel_nome}</span>
        <EtiquetaEstado t={t} />
      </p>
      {extra}
    </article>
  )
}

type Estado = { id: number; nome: string; categoria?: string }

/** Quadro (Kanban): uma coluna por estado; arrasta-se o cartão ou usa-se «Mover para» (teclado/telemóvel). */
function Quadro({ tarefas, estados, aCarregar }: { tarefas: TarefaResumo[]; estados: Estado[]; aCarregar: boolean }) {
  const qc = useQueryClient()
  const [pendente, setPendente] = useState<{ t: TarefaResumo; para: Estado } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [sobre, setSobre] = useState<number | null>(null)
  const mover = useMutation({
    mutationFn: ({ t, para, motivo = '' }: { t: TarefaResumo; para: Estado; motivo?: string }) =>
      tarefasApi.mudarEstado(t.id, para.id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      qc.invalidateQueries({ queryKey: ['agenda'] })
      setPendente(null)
      setMotivo('')
    },
  })
  const pedir = (t: TarefaResumo, para: Estado) => {
    if (t.estado === para.id) return
    if (pedeMotivo(t.estado_categoria, para.categoria)) setPendente({ t, para })
    else mover.mutate({ t, para })
  }
  const largar = (e: DragEvent, para: Estado) => {
    e.preventDefault()
    setSobre(null)
    const t = tarefas.find((x) => String(x.id) === e.dataTransfer.getData('text/plain'))
    if (t) pedir(t, para)
  }
  const erro =
    mover.error instanceof ErroApi
      ? Object.values(mover.error.campos).flat().join(' ') || mover.error.message
      : mover.error
        ? 'Não foi possível mudar o estado.'
        : null
  if (aCarregar) return <p className="a-carregar">A carregar…</p>
  return (
    <>
      {erro && !pendente && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      <div className="quadro" role="list" aria-label="Quadro de tarefas">
        {estados.map((est) => {
          const coluna = tarefas.filter((t) => t.estado === est.id)
          return (
            <section
              key={est.id}
              role="listitem"
              aria-label={est.nome}
              className={`quadro-coluna${sobre === est.id ? ' sobre' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(est.id)
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => largar(e, est)}
            >
              <h3>
                {est.nome} <span className="ajuda">({coluna.length})</span>
              </h3>
              {coluna.map((t) => (
                <div
                  key={t.id}
                  draggable={!mover.isPending}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
                >
                  <Cartao
                    t={t}
                    extra={
                      <select
                        className="mover-para"
                        aria-label={`Mover «${t.titulo}» para`}
                        value=""
                        onChange={(e) => {
                          const para = estados.find((x) => String(x.id) === e.target.value)
                          if (para) pedir(t, para)
                        }}
                      >
                        <option value="">Mover para…</option>
                        {estados
                          .filter((x) => x.id !== t.estado)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nome}
                            </option>
                          ))}
                      </select>
                    }
                  />
                </div>
              ))}
            </section>
          )
        })}
      </div>
      <p className="ajuda">O quadro mostra as tarefas por fazer e as fechadas nos últimos 30 dias.</p>
      <Dialogo
        titulo={pendente?.para.categoria === 'cancelada' ? 'Cancelar tarefa' : 'Reabrir tarefa'}
        aberto={!!pendente}
        aoFechar={() => setPendente(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setPendente(null)}>
              Voltar
            </button>
            <button
              className="botao-principal"
              disabled={mover.isPending}
              onClick={() => pendente && mover.mutate({ ...pendente, motivo })}
            >
              Confirmar
            </button>
          </>
        }
      >
        <p>
          «{pendente?.t.titulo}» → <strong>{pendente?.para.nome}</strong>
        </p>
        <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
      </Dialogo>
    </>
  )
}
