import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { useSessao } from '../../app/sessao'
import { agendaApi, NOMES_ORIGEM, type Evento } from './api'
import {
  deslocar,
  diasEntre,
  grelhaMes,
  hojeLisboa,
  horaDe,
  intervalo,
  nomeDia,
  tituloPeriodo,
  type Vista,
} from './datas'

const VISTAS: [Vista, string][] = [
  ['dia', 'Dia'],
  ['semana', 'Semana'],
  ['mes', 'Mês'],
  ['lista', 'Lista'],
]
const MAX_NO_MES = 3

/** Agenda (F4-02, D-51): compromissos e acontecimentos de outros módulos, sem cópias. */
export function Agenda() {
  const [params, setParams] = useSearchParams()
  const { utilizador } = useSessao()
  const vista = (params.get('vista') as Vista) || 'semana'
  const data = params.get('data') || hojeLisboa()
  const pessoa = params.get('pessoa') ?? String(utilizador?.id ?? '')
  const cancelados = params.get('cancelados') === '1'
  const mudar = (novo: Record<string, string>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(novo)) {
          if (v) n.set(k, v)
          else n.delete(k)
        }
        return n
      },
      { replace: true },
    )
  const opcoes = useQuery({ queryKey: ['agenda', 'opcoes'], queryFn: agendaApi.opcoes, staleTime: 60_000 })
  const [inicio, fim] = intervalo(vista, data)
  const pedidoEventos: Record<string, string> = { inicio, fim }
  if (pessoa !== 'todas' && pessoa) pedidoEventos.pessoa = pessoa
  if (cancelados) pedidoEventos.cancelados = '1'
  const eventos = useQuery({
    queryKey: ['agenda', 'eventos', pedidoEventos],
    queryFn: () => agendaApi.eventos(pedidoEventos),
    placeholderData: keepPreviousData,
  })
  const porDia = new Map<string, Evento[]>()
  for (const e of eventos.data ?? []) porDia.set(e.data, [...(porDia.get(e.data) ?? []), e])
  const pessoas = opcoes.data?.pessoas ?? []
  const hoje = hojeLisboa()

  return (
    <div className="pagina-lista agenda">
      <div className="separadores" role="tablist" aria-label="Vista da agenda">
        {VISTAS.map(([v, n]) => (
          <button
            key={v}
            role="tab"
            aria-selected={vista === v}
            className={vista === v ? 'ativo' : ''}
            onClick={() => mudar({ vista: v })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="barra-lista agenda-barra">
        <div className="agenda-navegar">
          <button
            className="botao-secundario"
            aria-label="Anterior"
            onClick={() => mudar({ data: deslocar(vista, data, -1) })}
          >
            ‹
          </button>
          <button className="botao-secundario" onClick={() => mudar({ data: '' })}>
            Hoje
          </button>
          <button
            className="botao-secundario"
            aria-label="Seguinte"
            onClick={() => mudar({ data: deslocar(vista, data, 1) })}
          >
            ›
          </button>
          <h2 className="agenda-periodo">{tituloPeriodo(vista, data)}</h2>
        </div>
        <div className="agenda-filtros">
          {pessoas.length > 1 && (
            <label className="campo-compacto">
              <span>Agenda de</span>
              <select value={pessoa} onChange={(e) => mudar({ pessoa: e.target.value })} aria-label="Agenda de">
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === utilizador?.id ? `${p.nome} (eu)` : p.nome}
                  </option>
                ))}
                <option value="todas">Todas as pessoas</option>
              </select>
            </label>
          )}
          <label className="campo-compacto">
            <input
              type="checkbox"
              checked={cancelados}
              onChange={(e) => mudar({ cancelados: e.target.checked ? '1' : '' })}
            />
            <span>Mostrar cancelados</span>
          </label>
          {opcoes.data?.pode_criar && (
            <Link
              to={`/agenda/compromissos/novo?data=${vista === 'mes' || vista === 'semana' ? hoje : data}`}
              className="botao-principal"
            >
              Novo compromisso
            </Link>
          )}
        </div>
      </div>

      {eventos.isError && <p className="erro">Não foi possível carregar a agenda.</p>}

      {vista === 'mes' && (
        <div className="agenda-mes" role="grid" aria-label={tituloPeriodo(vista, data)}>
          {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => (
            <div key={d} className="agenda-mes-cabecalho" role="columnheader">
              {d}
            </div>
          ))}
          {grelhaMes(data).map((d) => {
            const lista = porDia.get(d) ?? []
            return (
              <div
                key={d}
                role="gridcell"
                className={`agenda-mes-dia${d.slice(0, 7) !== data.slice(0, 7) ? ' fora' : ''}${d === hoje ? ' hoje' : ''}`}
              >
                <button
                  className="agenda-mes-numero"
                  onClick={() => mudar({ vista: 'dia', data: d })}
                  aria-label={nomeDia(d)}
                >
                  {Number(d.slice(8))}
                </button>
                {lista.slice(0, MAX_NO_MES).map((e) => (
                  <ItemEvento key={e.chave} e={e} compacto />
                ))}
                {lista.length > MAX_NO_MES && (
                  <button className="ligacao-botao" onClick={() => mudar({ vista: 'dia', data: d })}>
                    +{lista.length - MAX_NO_MES} mais
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {vista !== 'mes' && (
        <div className={`agenda-dias agenda-${vista}`}>
          {diasEntre(inicio, fim)
            .filter((d) => vista !== 'lista' || porDia.has(d))
            .map((d) => (
              <section key={d} className={`agenda-dia${d === hoje ? ' hoje' : ''}`}>
                <h3>
                  {vista === 'dia' ? (
                    'Acontecimentos'
                  ) : (
                    <button className="ligacao-botao" onClick={() => mudar({ vista: 'dia', data: d })}>
                      {nomeDia(d, vista === 'semana' ? 'short' : 'long')}
                    </button>
                  )}
                </h3>
                {(porDia.get(d) ?? []).length === 0 && <p className="ajuda">Sem acontecimentos.</p>}
                <ul className="agenda-eventos">
                  {(porDia.get(d) ?? []).map((e) => (
                    <li key={e.chave}>
                      <ItemEvento e={e} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          {vista === 'lista' && eventos.data?.length === 0 && (
            <p className="vazio-lista">Sem acontecimentos nos próximos 30 dias.</p>
          )}
        </div>
      )}

      <p className="ajuda agenda-legenda">
        {(Object.keys(NOMES_ORIGEM) as (keyof typeof NOMES_ORIGEM)[]).map((o) => (
          <span key={o}>
            <span className={`agenda-ponto origem-${o}`} aria-hidden /> {NOMES_ORIGEM[o]}
          </span>
        ))}
        <span>Visitas, tarefas e aniversários vêm das fichas de origem: altere-os lá.</span>
      </p>
    </div>
  )
}

function ItemEvento({ e, compacto = false }: { e: Evento; compacto?: boolean }) {
  const hora = e.dia_inteiro
    ? compacto
      ? ''
      : 'Dia todo'
    : `${horaDe(e.inicio!)}${e.fim && !compacto ? `–${horaDe(e.fim)}` : ''}`
  const riscado = e.estado_categoria === 'cancelado' || e.estado_categoria === 'cancelada'
  return (
    <Link
      to={e.caminho}
      className={`agenda-evento origem-${e.origem}${riscado ? ' cancelado' : ''}`}
      title={[NOMES_ORIGEM[e.origem], e.titulo, e.detalhe, e.estado_nome].filter(Boolean).join(' · ')}
    >
      <span className={`agenda-ponto origem-${e.origem}`} aria-hidden />
      {hora && <span className="agenda-hora">{hora}</span>}
      <span className="agenda-titulo">{e.titulo}</span>
      {!compacto && (
        <span className="agenda-detalhe">
          {[NOMES_ORIGEM[e.origem], e.detalhe, e.estado_nome, e.responsavel_nome].filter(Boolean).join(' · ')}
        </span>
      )}
    </Link>
  )
}
