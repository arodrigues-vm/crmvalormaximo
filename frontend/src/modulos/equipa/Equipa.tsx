import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { CampoSelecao, CampoTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { formatarTelefone, momentoPt } from '../../componentes/formatar'
import { Paginacao } from '../../componentes/Paginacao'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { useListaFiltrada } from '../../componentes/useListaFiltrada'
import { equipaApi, type Membro } from './api'

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
      <Bloco titulo="Dados profissionais">
        <dl className="grelha-dados">
          <Dado rotulo="Email (para entrar)">{m.email}</Dado>
          <Dado rotulo="Perfil">{m.perfil_nome}</Dado>
          <Dado rotulo="Equipa">{m.equipa_nome}</Dado>
          <Dado rotulo="Função">{m.funcao_comercial}</Dado>
          <Dado rotulo="Identificação profissional">{m.identificacao_profissional}</Dado>
          <Dado rotulo="NIF">{m.nif}</Dado>
          <Dado rotulo="Telefone">{m.telefone_e164 && formatarTelefone(m.telefone_e164)}</Dado>
        </dl>
      </Bloco>
      <Bloco titulo="Acesso">
        <dl className="grelha-dados">
          <Dado rotulo="Pode entrar no CRM">{m.ativo ? 'Sim' : 'Não (desativado)'}</Dado>
          <Dado rotulo="Início de sessão em dois passos">{m.mfa_ativa ? 'Ativo' : 'Desligado'}</Dado>
          <Dado rotulo="Último acesso">{m.ultimo_acesso && momentoPt(m.ultimo_acesso)}</Dado>
          <Dado rotulo="Membro desde">{momentoPt(m.date_joined)}</Dado>
        </dl>
      </Bloco>
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
      <Bloco titulo="Dados profissionais">
        <div className="grelha-campos">
          <CampoTexto rotulo="Nome" required value={v.nome} onChange={m('nome')} erro={erros.nome} />
          <CampoTexto
            rotulo="Função"
            value={v.funcao_comercial}
            onChange={m('funcao_comercial')}
            placeholder="Ex.: Consultor imobiliário"
          />
          <CampoTexto
            rotulo="Identificação profissional"
            value={v.identificacao_profissional}
            onChange={m('identificacao_profissional')}
          />
          <CampoTexto rotulo="NIF" value={v.nif} onChange={m('nif')} erro={erros.nif} />
          <CampoTexto rotulo="Telefone" value={v.telefone} onChange={m('telefone')} erro={erros.telefone} />
          <CampoSelecao
            rotulo="Equipa"
            vazio="—"
            value={v.equipa}
            onChange={m('equipa')}
            opcoes={(opcoes.data?.equipas ?? []).map((x) => ({ valor: x.id, nome: x.nome }))}
          />
        </div>
      </Bloco>
      <Bloco titulo="Acesso ao CRM">
        <div className="grelha-campos">
          <CampoTexto
            rotulo="Email (para entrar)"
            type="email"
            required
            value={v.email}
            onChange={m('email')}
            erro={erros.email}
          />
          <CampoSelecao
            rotulo="Perfil"
            value={v.perfil}
            onChange={m('perfil')}
            opcoes={opcoes.data?.perfis ?? []}
            erro={erros.perfil}
          />
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
        </div>
      </Bloco>
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
