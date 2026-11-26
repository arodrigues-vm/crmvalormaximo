import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoSelecao, CampoTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { formatarEuros, formatarPercentagem, formatarTelefone, momentoPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { equipaApi, type Membro } from './api'

/** Formas de cálculo da comissão de um consultor (D-48). */
const MODOS_COMISSAO: Record<string, string> = {
  percentagem: 'Percentagem de cada lado',
  deducao: 'Lado menos um valor fixo da agência',
}
const dec = (x: string) => (x.trim() ? x.trim().replace(',', '.') : null)
import { ECRA_MEMBRO } from './disposicao'

function Navegacao({ atual }: { atual: 'membros' | 'equipas' }) {
  return (
    <nav className="separadores" aria-label="Equipa">
      <Link to="/equipa" className={atual === 'membros' ? 'ativo' : ''}>
        Membros
      </Link>
      <Link to="/equipa/equipas" className={atual === 'equipas' ? 'ativo' : ''}>
        Equipas
      </Link>
    </nav>
  )
}

export function MembrosLista() {
  const { params, mudar, termo, setTermo, pagina, consulta } = useListaFiltrada()
  const navegar = useNavigate()
  const opcoes = useQuery({ queryKey: ['equipa', 'opcoes'], queryFn: equipaApi.opcoes, staleTime: 60_000 })
  const pedidoLista: Record<string, string> = { ativo: 'true', ...consulta }
  if (pedidoLista.ativo === 'todos') delete pedidoLista.ativo
  const lista = useQuery({
    queryKey: ['equipa', 'membros', pedidoLista],
    queryFn: () => equipaApi.listar(pedidoLista),
    placeholderData: keepPreviousData,
  })
  return (
    <div className="pagina-lista">
      <Navegacao atual="membros" />
      <div className="barra-lista">
        <input
          type="search"
          className="pesquisa"
          aria-label="Pesquisar membros"
          placeholder="Pesquisar por nome ou email"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <select
          aria-label="Equipa"
          value={params.get('equipa') ?? ''}
          onChange={(e) => mudar({ equipa: e.target.value, page: '' })}
        >
          <option value="">Todas as equipas</option>
          {opcoes.data?.equipas.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Perfil"
          value={params.get('perfil') ?? ''}
          onChange={(e) => mudar({ perfil: e.target.value, page: '' })}
        >
          <option value="">Todos os perfis</option>
          {opcoes.data?.perfis.map((x) => (
            <option key={x.valor} value={x.valor}>
              {x.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Situação"
          value={params.get('ativo') ?? 'true'}
          onChange={(e) => mudar({ ativo: e.target.value === 'true' ? '' : e.target.value, page: '' })}
        >
          <option value="true">Ativos</option>
          <option value="false">Desativados</option>
          <option value="todos">Todos</option>
        </select>
        {opcoes.data?.pode_gerir && (
          <Link to="/equipa/novo" className="botao-principal">
            + Novo membro
          </Link>
        )}
      </div>
      {lista.data?.count === 0 && <p className="vazio-lista">Nenhum membro encontrado.</p>}
      {lista.data && lista.data.count > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Perfil</th>
              <th>Equipa</th>
              <th>Função</th>
              <th>Contacto</th>
            </tr>
          </thead>
          <tbody>
            {lista.data.results.map((m) => (
              <tr key={m.id} onClick={() => navegar(`/equipa/${m.id}`)} className={m.ativo ? '' : 'inativa'}>
                <td data-rotulo="Nome" className="celula-principal">
                  <Link to={`/equipa/${m.id}`} onClick={(e) => e.stopPropagation()}>
                    {m.nome}
                  </Link>
                  {!m.ativo && <span className="etiqueta etiqueta-neutra">Desativado</span>}
                </td>
                <td data-rotulo="Perfil">{m.perfil_nome}</td>
                <td data-rotulo="Equipa">{m.equipa_nome ?? '—'}</td>
                <td data-rotulo="Função">{m.funcao_comercial || '—'}</td>
                <td data-rotulo="Contacto">{m.telefone_e164 ? formatarTelefone(m.telefone_e164) : m.email}</td>
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

export function MembroConsulta() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [reporAberto, setReporAberto] = useState(false)
  const { data: m, isLoading } = useQuery({ queryKey: ['equipa', 'membro', id], queryFn: () => equipaApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['equipa', 'opcoes'], queryFn: equipaApi.opcoes, staleTime: 60_000 })
  const repor = useMutation({
    mutationFn: () => equipaApi.reporMfa(Number(id)),
    onSuccess: (n) => {
      qc.setQueryData(['equipa', 'membro', id], n)
      setReporAberto(false)
    },
  })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!m) return <p className="aviso">Membro não encontrado.</p>
  const gerir = opcoes.data?.pode_gerir
  const mb = m
  function desenharCampo(c: string): ReactNode {
    switch (c) {
      case 'email':
        return <Dado rotulo="Email (para entrar)">{mb.email}</Dado>
      case 'perfil':
        return <Dado rotulo="Perfil">{mb.perfil_nome}</Dado>
      case 'equipa':
        return <Dado rotulo="Equipa">{mb.equipa_nome}</Dado>
      case 'funcao_comercial':
        return <Dado rotulo="Função">{mb.funcao_comercial}</Dado>
      case 'identificacao_profissional':
        return <Dado rotulo="Identificação profissional">{mb.identificacao_profissional}</Dado>
      case 'nif':
        return <Dado rotulo="NIF">{mb.nif}</Dado>
      case 'telefone':
        return <Dado rotulo="Telefone">{mb.telefone_e164 && formatarTelefone(mb.telefone_e164)}</Dado>
      case 'ativo':
        return <Dado rotulo="Pode entrar no CRM">{mb.ativo ? 'Sim' : 'Não (desativado)'}</Dado>
      case 'mfa':
        return <Dado rotulo="Início de sessão em dois passos">{mb.mfa_ativa ? 'Ativo' : 'Desligado'}</Dado>
      case 'ultimo_acesso':
        return <Dado rotulo="Último acesso">{mb.ultimo_acesso && momentoPt(mb.ultimo_acesso)}</Dado>
      case 'membro_desde':
        return <Dado rotulo="Membro desde">{momentoPt(mb.date_joined)}</Dado>
      case 'comissao_modo':
        return <Dado rotulo="Forma de cálculo da comissão">{MODOS_COMISSAO[mb.comissao_modo]}</Dado>
      case 'comissao_pct_angariacao':
        return mb.comissao_modo === 'percentagem' ? (
          <Dado rotulo="% sobre o lado da angariação">{formatarPercentagem(mb.comissao_pct_angariacao)}</Dado>
        ) : null
      case 'comissao_pct_venda':
        return mb.comissao_modo === 'percentagem' ? (
          <Dado rotulo="% sobre o lado da venda">{formatarPercentagem(mb.comissao_pct_venda)}</Dado>
        ) : null
      case 'comissao_deducao':
        return mb.comissao_modo === 'deducao' ? (
          <Dado rotulo="Valor fixo que fica para a agência">{formatarEuros(mb.comissao_deducao)}</Dado>
        ) : null
      case 'nome':
        return <Dado rotulo="Nome">{mb.nome}</Dado>
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Equipa"
        caminho="/equipa"
        referencia={m.perfil_nome}
        titulo={m.nome}
        etiqueta={m.ativo ? undefined : { texto: 'Desativado', tipo: 'neutra' }}
        acoes={
          gerir && (
            <>
              {m.mfa_ativa && (
                <button className="botao-secundario" onClick={() => setReporAberto(true)}>
                  Repor dois passos
                </button>
              )}
              <Link to={`/equipa/${m.id}/editar`} className="botao-principal">
                Editar
              </Link>
            </>
          )
        }
      />
      <BlocosConfiguraveis def={ECRA_MEMBRO} modo="ver" campo={desenharCampo} />
      <Dialogo
        titulo="Repor início de sessão em dois passos"
        aberto={reporAberto}
        aoFechar={() => setReporAberto(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setReporAberto(false)}>
              Cancelar
            </button>
            <button className="botao-perigo" disabled={repor.isPending} onClick={() => repor.mutate()}>
              Repor
            </button>
          </>
        }
      >
        <p>
          Use quando {m.nome} perdeu o telemóvel. A configuração atual é apagada; se os dois passos forem obrigatórios
          para o perfil, na próxima entrada terá de os ativar de novo.
        </p>
      </Dialogo>
    </div>
  )
}

export function MembroNovo() {
  return <FormularioMembro />
}

export function MembroEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['equipa', 'membro', id], queryFn: () => equipaApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Membro não encontrado.</p>
  return <FormularioMembro membro={data} />
}

function FormularioMembro({ membro }: { membro?: Membro }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['equipa', 'opcoes'], queryFn: equipaApi.opcoes, staleTime: 60_000 })
  const inicial = useMemo(
    () => ({
      nome: membro?.nome ?? '',
      email: membro?.email ?? '',
      perfil: membro?.perfil ?? 'consultor',
      equipa: membro?.equipa ? String(membro.equipa) : '',
      funcao_comercial: membro?.funcao_comercial ?? '',
      identificacao_profissional: membro?.identificacao_profissional ?? '',
      nif: membro?.nif ?? '',
      telefone: membro?.telefone ?? '',
      ativo: membro ? (membro.ativo ? 'sim' : 'nao') : 'sim',
      password: '',
      comissao_modo: membro?.comissao_modo ?? '',
      comissao_pct_angariacao: membro?.comissao_pct_angariacao ? String(Number(membro.comissao_pct_angariacao)) : '',
      comissao_pct_venda: membro?.comissao_pct_venda ? String(Number(membro.comissao_pct_venda)) : '',
      comissao_deducao: membro?.comissao_deducao ? String(Number(membro.comissao_deducao)) : '',
    }),
    [membro],
  )
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const m = (c: keyof typeof v) => (e: { target: { value: string } }) => setV((a) => ({ ...a, [c]: e.target.value }))
  if (opcoes.data && !opcoes.data.pode_gerir) return <p className="aviso">Só o Administrador gere a Equipa.</p>

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo: Record<string, unknown> = {
      nome: v.nome,
      email: v.email,
      perfil: v.perfil,
      equipa: v.equipa ? Number(v.equipa) : null,
      funcao_comercial: v.funcao_comercial,
      identificacao_profissional: v.identificacao_profissional,
      nif: v.nif,
      telefone: v.telefone,
      ativo: v.ativo === 'sim',
      comissao_modo: v.comissao_modo,
      comissao_pct_angariacao: v.comissao_modo === 'percentagem' ? dec(v.comissao_pct_angariacao) : null,
      comissao_pct_venda: v.comissao_modo === 'percentagem' ? dec(v.comissao_pct_venda) : null,
      comissao_deducao: v.comissao_modo === 'deducao' ? dec(v.comissao_deducao) : null,
    }
    if (v.password) corpo.password = v.password
    try {
      const r = membro ? await equipaApi.atualizar(membro.id, corpo) : await equipaApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['equipa'] })
      navegar(`/equipa/${r.id}`, { replace: !membro })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  function desenharCampo(c: string): ReactNode {
    switch (c) {
      case 'nome':
        return <CampoTexto rotulo="Nome" required value={v.nome} onChange={m('nome')} erro={erros.nome} />
      case 'funcao_comercial':
        return (
          <CampoTexto
            rotulo="Função"
            value={v.funcao_comercial}
            onChange={m('funcao_comercial')}
            placeholder="Ex.: Consultor imobiliário"
          />
        )
      case 'identificacao_profissional':
        return (
          <CampoTexto
            rotulo="Identificação profissional"
            value={v.identificacao_profissional}
            onChange={m('identificacao_profissional')}
          />
        )
      case 'nif':
        return <CampoTexto rotulo="NIF" value={v.nif} onChange={m('nif')} erro={erros.nif} />
      case 'comissao_modo':
        return (
          <CampoSelecao
            rotulo="Forma de cálculo da comissão"
            vazio="— (indicar em cada comissão)"
            value={v.comissao_modo}
            onChange={m('comissao_modo')}
            opcoes={Object.entries(MODOS_COMISSAO).map(([valor, nome]) => ({ valor, nome }))}
            ajuda="O CRM propõe-na em cada comissão; lá pode ser mudada."
          />
        )
      case 'comissao_pct_angariacao':
        return v.comissao_modo === 'percentagem' ? (
          <CampoTexto
            rotulo="% sobre o lado da angariação"
            inputMode="decimal"
            value={v.comissao_pct_angariacao}
            onChange={m('comissao_pct_angariacao')}
            erro={erros.comissao_pct_angariacao}
          />
        ) : null
      case 'comissao_pct_venda':
        return v.comissao_modo === 'percentagem' ? (
          <CampoTexto
            rotulo="% sobre o lado da venda"
            inputMode="decimal"
            value={v.comissao_pct_venda}
            onChange={m('comissao_pct_venda')}
            erro={erros.comissao_pct_venda}
          />
        ) : null
      case 'comissao_deducao':
        return v.comissao_modo === 'deducao' ? (
          <CampoTexto
            rotulo="Valor fixo que fica para a agência (€)"
            inputMode="decimal"
            value={v.comissao_deducao}
            onChange={m('comissao_deducao')}
            erro={erros.comissao_deducao}
            ajuda="O consultor recebe o lado da comissão menos este valor."
          />
        ) : null
      case 'telefone':
        return <CampoTexto rotulo="Telefone" value={v.telefone} onChange={m('telefone')} erro={erros.telefone} />
      case 'equipa':
        return (
          <CampoSelecao
            rotulo="Equipa"
            vazio="—"
            value={v.equipa}
            onChange={m('equipa')}
            opcoes={(opcoes.data?.equipas ?? []).map((x) => ({ valor: x.id, nome: x.nome }))}
          />
        )
      case 'email':
        return (
          <CampoTexto
            rotulo="Email (para entrar)"
            type="email"
            required
            value={v.email}
            onChange={m('email')}
            erro={erros.email}
          />
        )
      case 'perfil':
        return (
          <CampoSelecao
            rotulo="Perfil"
            value={v.perfil}
            onChange={m('perfil')}
            opcoes={opcoes.data?.perfis ?? []}
            erro={erros.perfil}
          />
        )
      case 'ativo':
        return (
          <CampoSelecao
            rotulo="Pode entrar no CRM"
            value={v.ativo}
            onChange={m('ativo')}
            opcoes={[
              { valor: 'sim', nome: 'Sim' },
              { valor: 'nao', nome: 'Não (desativado)' },
            ]}
            erro={erros.ativo}
          />
        )
      case 'password':
        return (
          <CampoTexto
            rotulo={membro ? 'Nova palavra-passe' : 'Palavra-passe inicial'}
            type="password"
            autoComplete="new-password"
            required={!membro}
            value={v.password}
            onChange={m('password')}
            erro={erros.password}
            ajuda={
              membro ? 'Deixe vazio para não mudar.' : 'Mínimo 12 caracteres. Entregue-a à pessoa de forma segura.'
            }
          />
        )
    }
    return null
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Equipa"
        caminho="/equipa"
        referencia={membro ? membro.perfil_nome : 'Novo'}
        titulo={membro ? `Editar ${membro.nome}` : 'Novo membro'}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <BlocosConfiguraveis def={ECRA_MEMBRO} modo="editar" campo={desenharCampo} erros={erros} />
      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(membro ? `/equipa/${membro.id}` : '/equipa')}
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

export function EquipasLista() {
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['equipa', 'opcoes'], queryFn: equipaApi.opcoes, staleTime: 60_000 })
  const { data = [] } = useQuery({ queryKey: ['equipa', 'equipas'], queryFn: equipaApi.equipas })
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const atualizar = () => qc.invalidateQueries({ queryKey: ['equipa'] })
  const criar = useMutation({
    mutationFn: () => equipaApi.criarEquipa(nova.trim()),
    onSuccess: () => {
      setNova('')
      setErro(null)
      atualizar()
    },
    onError: (e) => setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falhou.'),
  })
  const [aRenomear, setARenomear] = useState<{ id: number; nome: string } | null>(null)
  const renomear = useMutation({
    mutationFn: (e: { id: number; nome: string }) => equipaApi.atualizarEquipa(e.id, { nome: e.nome.trim() }),
    onSuccess: () => {
      setARenomear(null)
      setErro(null)
      atualizar()
    },
    onError: (e) => setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falhou.'),
  })
  const alternar = useMutation({
    mutationFn: (e: { id: number; ativa: boolean }) => equipaApi.atualizarEquipa(e.id, { ativa: !e.ativa }),
    onSuccess: atualizar,
  })
  const gerir = opcoes.data?.pode_gerir
  return (
    <div className="pagina-lista">
      <Navegacao atual="equipas" />
      <p className="ajuda">
        As equipas agrupam os membros. O Responsável de Equipa vê e gere os registos da sua equipa.
      </p>
      <ul className="lista-relacoes">
        {data.map((e) => (
          <li key={e.id}>
            {aRenomear?.id === e.id ? (
              <form
                className="valor-novo"
                onSubmit={(ev) => {
                  ev.preventDefault()
                  if (aRenomear.nome.trim()) renomear.mutate(aRenomear)
                }}
              >
                <input
                  aria-label={`Novo nome de ${e.nome}`}
                  value={aRenomear.nome}
                  autoFocus
                  onChange={(ev) => setARenomear({ id: e.id, nome: ev.target.value })}
                />
                <button type="submit" className="botao-principal" disabled={renomear.isPending}>
                  Guardar
                </button>
                <button type="button" className="botao-secundario" onClick={() => setARenomear(null)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <strong>{e.nome}</strong>
            )}
            <span className="ajuda">
              {e.n_membros} membro{e.n_membros === 1 ? '' : 's'} ativo{e.n_membros === 1 ? '' : 's'}
            </span>
            {!e.ativa && <span className="etiqueta etiqueta-neutra">Inativa</span>}
            {gerir && aRenomear?.id !== e.id && (
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setARenomear({ id: e.id, nome: e.nome })}
              >
                Mudar nome
              </button>
            )}
            {gerir && (
              <button type="button" className="botao-secundario" onClick={() => alternar.mutate(e)}>
                {e.ativa ? 'Desativar' : 'Reativar'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {gerir && (
        <form
          className="valor-novo"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (nova.trim()) criar.mutate()
          }}
        >
          <input
            aria-label="Nome da nova equipa"
            placeholder="Nome da nova equipa"
            value={nova}
            onChange={(ev) => setNova(ev.target.value)}
          />
          <button type="submit" className="botao-principal" disabled={!nova.trim() || criar.isPending}>
            Acrescentar equipa
          </button>
        </form>
      )}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
