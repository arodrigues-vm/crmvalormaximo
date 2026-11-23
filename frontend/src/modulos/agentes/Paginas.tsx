import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import {
  qualificacaoParaApi,
  valoresQualificacao,
  type CampoQualificacao,
  type Opcoes,
  type Registo,
} from '../../componentes/camposQualificacao'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { formatarTelefone, momentoPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { EditarQualificacao, VerQualificacao } from '../../componentes/Qualificacao'
import { SeletorLocalizacao } from '../../componentes/SeletorLocalizacao'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import {
  agenciasApi,
  agentesApi,
  CAMPOS_AGENCIA,
  CAMPOS_AGENTE,
  MORADA_AGENCIA,
  OBSERVACOES,
  type RegistoAgente,
} from './api'

/** Agentes e Agências partilham as mesmas páginas (D-37), com configurações diferentes. */
interface Config {
  chave: 'agentes' | 'agencias'
  caminho: string
  singular: string
  plural: string
  novo: string
  tituloNovo: string
  api: typeof agentesApi
  campos: CampoQualificacao[]
  morada: boolean
}

const AGENTES: Config = {
  chave: 'agentes',
  caminho: '/agentes',
  singular: 'agente',
  plural: 'Agentes',
  novo: '+ Novo agente',
  tituloNovo: 'Novo agente',
  api: agentesApi,
  campos: CAMPOS_AGENTE,
  morada: false,
}
const AGENCIAS: Config = {
  chave: 'agencias',
  caminho: '/agencias',
  singular: 'agência',
  plural: 'Agências',
  novo: '+ Nova agência',
  tituloNovo: 'Nova agência',
  api: agenciasApi,
  campos: CAMPOS_AGENCIA,
  morada: true,
}

const comNomes = (r: RegistoAgente): Registo => ({
  ...(r as unknown as Registo),
  nomes: { tipo: r.tipo_nome, status: r.status_nome, utilizador: r.utilizador_nome },
})

function Lista({ c }: { c: Config }) {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const opcoes = useQuery({ queryKey: [c.chave, 'opcoes'], queryFn: c.api.opcoes, staleTime: 60_000 })
  const lista = useQuery({
    queryKey: [c.chave, 'lista', consulta],
    queryFn: () => c.api.listar(consulta),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="pagina-lista">
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label={`Pesquisar ${c.plural.toLowerCase()}`}
          placeholder={
            c.morada
              ? 'Pesquisar por nome, NIF, email ou telefone'
              : 'Pesquisar por nome, agência, NIF, email ou telefone'
          }
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <select
          aria-label="Tipo"
          value={params.get('tipo') ?? ''}
          onChange={(e) => mudar({ tipo: e.target.value, page: '' })}
        >
          <option value="">Todos os tipos</option>
          {opcoes.data?.tipos.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        {opcoes.data?.tipos_agencia && (
          <select
            aria-label="Tipo de agência"
            value={params.get('tipo_agencia') ?? ''}
            onChange={(e) => mudar({ tipo_agencia: e.target.value, page: '' })}
          >
            <option value="">Todos os tipos de agência</option>
            {opcoes.data.tipos_agencia.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        )}
        {opcoes.data?.pode_criar && (
          <Link to={`${c.caminho}/novo`} className="botao-principal">
            {c.novo}
          </Link>
        )}
      </div>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhum registo encontrado.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>{c.morada ? 'Licença AMI' : 'Agência'}</th>
              <th>Contacto</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((r) => (
              <tr
                key={r.id}
                onClick={() => navegar(`${c.caminho}/${r.id}`)}
                className={r.status_categoria === 'inativo' ? 'inativa' : ''}
              >
                <td data-rotulo="Nome" className="celula-principal">
                  <Link to={`${c.caminho}/${r.id}`} onClick={(e) => e.stopPropagation()}>
                    {r.nome}
                  </Link>
                </td>
                <td data-rotulo="Tipo">{r.tipo_nome ?? '—'}</td>
                <td data-rotulo={c.morada ? 'Licença AMI' : 'Agência'}>
                  {(c.morada ? r.licenca_ami : r.agencia_nome) || '—'}
                </td>
                <td data-rotulo="Contacto">{r.telefone_e164 ? formatarTelefone(r.telefone_e164) : r.email || '—'}</td>
                <td data-rotulo="Status">{r.status_nome ?? '—'}</td>
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

function Consulta({ c }: { c: Config }) {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [eliminarAberto, setEliminarAberto] = useState(false)
  const { data: r, error, isLoading } = useQuery({ queryKey: [c.chave, id], queryFn: () => c.api.obter(id) })
  const agentes = useQuery({
    queryKey: ['agentes', 'lista', { agencia: id }],
    queryFn: () => agentesApi.listar({ agencia: id }),
    enabled: c.morada,
  })
  const eliminar = useMutation({
    mutationFn: () => c.api.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [c.chave] })
      navegar(c.caminho, { replace: true })
    },
  })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Registo não encontrado ou sem acesso.</p>
  if (!r) return <p className="erro">Não foi possível carregar o registo.</p>
  const registo = comNomes(r)
  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo={c.plural}
        caminho={c.caminho}
        referencia={r.referencia}
        titulo={r.nome}
        etiqueta={
          r.status_nome
            ? { texto: r.status_nome, tipo: r.status_categoria === 'ativo' ? 'sucesso' : 'neutra' }
            : undefined
        }
        acoes={
          <>
            {r.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setEliminarAberto(true)}>
                Eliminar
              </button>
            )}
            {r.acoes.editar && (
              <Link to={`${c.caminho}/${r.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />
      <Bloco titulo="Dados">
        <VerQualificacao campos={c.campos} registo={registo} />
        {!c.morada && (
          <dl className="grelha-dados">
            <Dado rotulo="Agência">{r.agencia && <Link to={`/agencias/${r.agencia}`}>{r.agencia_nome}</Link>}</Dado>
          </dl>
        )}
      </Bloco>
      {c.morada && (
        <>
          <Bloco titulo="Morada">
            <VerQualificacao campos={MORADA_AGENCIA} registo={registo} />
            <dl className="grelha-dados">
              <Dado rotulo="Distrito, concelho e freguesia" largo>
                {r.localizacao && `${r.localizacao.distrito} › ${r.localizacao.concelho} › ${r.localizacao.freguesia}`}
              </Dado>
            </dl>
          </Bloco>
          <Bloco titulo="Agentes" resumo={agentes.data ? String(agentes.data.count) : undefined}>
            {agentes.data?.count === 0 && <p className="ajuda">Sem agentes registados nesta agência.</p>}
            <ul className="lista-relacoes">
              {agentes.data?.results.map((a) => (
                <li key={a.id}>
                  <Link to={`/agentes/${a.id}`}>{a.nome}</Link>
                  <span className="ajuda">{a.tipo_nome}</span>
                </li>
              ))}
            </ul>
          </Bloco>
        </>
      )}
      <Bloco titulo="Observações" abertoInicial={!!r.observacoes}>
        <VerQualificacao campos={OBSERVACOES} registo={registo} />
      </Bloco>
      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={[c.chave, r.id, 'historico']}
              obter={() => c.api.historico(r.id)}
              nomesCampos={{}}
            />
            <p className="ajuda">Criado em {momentoPt(r.criado_em)}</p>
          </>
        )}
      </Bloco>
      <Dialogo
        titulo={`Eliminar ${c.singular}`}
        aberto={eliminarAberto}
        aoFechar={() => setEliminarAberto(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setEliminarAberto(false)}>
              Cancelar
            </button>
            <button className="botao-perigo" onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>Se já não trabalha com este {c.singular}, prefira mudar o Status para «Inativo».</p>
      </Dialogo>
    </div>
  )
}

function Formulario({ c, r }: { c: Config; r?: RegistoAgente }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: [c.chave, 'opcoes'], queryFn: c.api.opcoes, staleTime: 60_000 })
  const campos = c.morada ? [...c.campos, ...MORADA_AGENCIA, ...OBSERVACOES] : [...c.campos, ...OBSERVACOES]
  const inicial = useMemo(
    () => ({
      extra: valoresQualificacao(campos, r ? comNomes(r) : undefined),
      freguesia: r?.freguesia ?? null,
      agencia: r?.agencia ? ({ id: r.agencia, titulo: r.agencia_nome ?? '' } as OpcaoPesquisa) : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r],
  )
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const editar = (lista: CampoQualificacao[]) => (
    <EditarQualificacao
      campos={lista}
      valores={v.extra}
      aoMudar={(k, x) => setV((a) => ({ ...a, extra: { ...a.extra, [k]: x } }))}
      opcoes={opcoes.data as unknown as Opcoes | undefined}
      erros={erros}
      nomesAtuais={r ? comNomes(r).nomes : undefined}
    />
  )

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo: Record<string, unknown> = { ...qualificacaoParaApi(campos, v.extra) }
    if (c.morada) corpo.freguesia = v.freguesia
    else corpo.agencia = v.agencia?.id ?? null
    try {
      const novo = r ? await c.api.atualizar(r.id, { ...corpo, versao: r.versao }) : await c.api.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: [c.chave] })
      qc.setQueryData([c.chave, String(novo.id)], novo)
      navegar(`${c.caminho}/${novo.id}`, { replace: !r })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo={c.plural}
        caminho={c.caminho}
        referencia={r?.referencia ?? 'Novo'}
        titulo={r ? `Editar ${c.singular}` : c.tituloNovo}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <Bloco titulo="Dados">
        {editar(c.campos)}
        {!c.morada && (
          <div className="grelha-campos">
            <SeletorPesquisavel
              rotulo="Agência"
              chave="agencias"
              procurar={agenciasApi.procurar}
              valor={v.agencia}
              aoMudar={(x) => setV((a) => ({ ...a, agencia: x }))}
              erro={erros.agencia?.join(' ')}
            />
          </div>
        )}
      </Bloco>
      {c.morada && (
        <Bloco titulo="Morada">
          {editar(MORADA_AGENCIA)}
          <div className="grelha-campos">
            <SeletorLocalizacao
              freguesia={v.freguesia}
              atual={r?.freguesia === v.freguesia ? (r?.localizacao ?? null) : null}
              aoMudar={(f) => setV((a) => ({ ...a, freguesia: f }))}
            />
          </div>
        </Bloco>
      )}
      <Bloco titulo="Observações" abertoInicial={!!r?.observacoes}>
        {editar(OBSERVACOES)}
      </Bloco>
      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(r ? `${c.caminho}/${r.id}` : c.caminho)}
        >
          Cancelar
        </button>
        <button type="submit" className="botao-principal" disabled={aGravar}>
          {aGravar ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
      {guarda.dialogo}
    </form>
  )
}

function Editar({ c }: { c: Config }) {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: [c.chave, id], queryFn: () => c.api.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Registo não encontrado ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar este registo.</p>
  return <Formulario c={c} r={data} key={data.versao} />
}

export const AgentesLista = () => <Lista c={AGENTES} />
export const AgenteConsulta = () => <Consulta c={AGENTES} />
export const AgenteNovo = () => <Formulario c={AGENTES} />
export const AgenteEditar = () => <Editar c={AGENTES} />
export const AgenciasLista = () => <Lista c={AGENCIAS} />
export const AgenciaConsulta = () => <Consulta c={AGENCIAS} />
export const AgenciaNovo = () => <Formulario c={AGENCIAS} />
export const AgenciaEditar = () => <Editar c={AGENCIAS} />
