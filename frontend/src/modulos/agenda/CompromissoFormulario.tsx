import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { procurarImoveis } from '../imoveis/api'
import { agendaApi, type Compromisso } from './api'
import { hojeLisboa, paraCampo } from './datas'
import { ECRA_COMPROMISSO } from './disposicao'

interface Valores {
  titulo: string
  tipo: string
  inicio: string
  fim: string
  local: string
  descricao: string
  responsavel: string
  entidade: OpcaoPesquisa | null
  imovel: OpcaoPesquisa | null
}

export function CompromissoNovo() {
  const [p] = useSearchParams()
  const dia = p.get('data') || hojeLisboa()
  return (
    <Formulario
      inicial={{
        titulo: '',
        tipo: '',
        inicio: `${dia}T10:00`,
        fim: '',
        local: '',
        descricao: '',
        responsavel: '',
        entidade: null,
        imovel: null,
      }}
    />
  )
}

export function CompromissoEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['agenda', 'compromisso', id], queryFn: () => agendaApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Compromisso não encontrado ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar este compromisso.</p>
  return (
    <Formulario
      key={data.versao}
      compromisso={data}
      inicial={{
        titulo: data.titulo,
        tipo: data.tipo ? String(data.tipo) : '',
        inicio: paraCampo(data.inicio),
        fim: paraCampo(data.fim),
        local: data.local,
        descricao: data.descricao,
        responsavel: String(data.responsavel),
        entidade: data.entidade ? { id: data.entidade, titulo: data.entidade_nome ?? '' } : null,
        imovel: data.imovel ? { id: data.imovel, titulo: data.imovel_descricao ?? '' } : null,
      }}
    />
  )
}

function Formulario({ compromisso, inicial }: { compromisso?: Compromisso; inicial: Valores }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const base0 = useMemo(() => inicial, [inicial])
  const [v, setV] = useState(base0)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const cp = usePersonalizados(ECRA_COMPROMISSO, comoRegistoCp(compromisso))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(base0) || cp.alterado)
  const opcoes = useQuery({ queryKey: ['agenda', 'opcoes'], queryFn: agendaApi.opcoes, staleTime: 60_000 })
  const mudar = <K extends keyof Valores>(k: K, x: Valores[K]) => setV((a) => ({ ...a, [k]: x }))

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo = {
      titulo: v.titulo,
      tipo: v.tipo ? Number(v.tipo) : null,
      inicio: v.inicio || null,
      fim: v.fim || null,
      local: v.local,
      descricao: v.descricao,
      responsavel: v.responsavel ? Number(v.responsavel) : undefined,
      entidade: v.entidade?.id ?? null,
      imovel: v.imovel?.id ?? null,
      campos_personalizados: cp.paraApi(),
    }
    try {
      const r = compromisso
        ? await agendaApi.atualizar(compromisso.id, { ...corpo, versao: compromisso.versao })
        : await agendaApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['agenda'] })
      qc.setQueryData(['agenda', 'compromisso', String(r.id)], r)
      navegar(`/agenda/compromissos/${r.id}`, { replace: !compromisso })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos as Record<string, string[]>)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'titulo':
        return (
          <CampoTexto
            rotulo="Título"
            required
            value={v.titulo}
            onChange={(e) => mudar('titulo', e.target.value)}
            erro={erros.titulo}
          />
        )
      case 'tipo':
        return (
          <CampoSelecao
            rotulo="Tipo"
            vazio="—"
            value={v.tipo}
            onChange={(e) => mudar('tipo', e.target.value)}
            opcoes={(opcoes.data?.tipos ?? []).map((x) => ({ valor: x.id, nome: x.nome }))}
            erro={erros.tipo}
          />
        )
      case 'inicio':
        return (
          <CampoTexto
            rotulo="Início"
            type="datetime-local"
            required
            value={v.inicio}
            onChange={(e) => mudar('inicio', e.target.value)}
            erro={erros.inicio}
          />
        )
      case 'fim':
        return (
          <CampoTexto
            rotulo="Fim"
            type="datetime-local"
            value={v.fim}
            onChange={(e) => mudar('fim', e.target.value)}
            erro={erros.fim}
            ajuda="Opcional."
          />
        )
      case 'local':
        return (
          <CampoTexto
            rotulo="Local"
            value={v.local}
            onChange={(e) => mudar('local', e.target.value)}
            erro={erros.local}
          />
        )
      case 'responsavel':
        return (
          <CampoResponsavel
            modulo="agenda"
            valor={v.responsavel}
            atual={compromisso ? { id: compromisso.responsavel, nome: compromisso.responsavel_nome } : null}
            aoMudar={(x) => mudar('responsavel', x)}
            erro={erros.responsavel}
          />
        )
      case 'entidade':
        return (
          <SeletorPesquisavel
            rotulo="Entidade"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={v.entidade}
            aoMudar={(x) => mudar('entidade', x)}
            erro={erros.entidade?.join(' ')}
          />
        )
      case 'imovel':
        return (
          <SeletorPesquisavel
            rotulo="Imóvel"
            chave="imoveis"
            procurar={procurarImoveis}
            valor={v.imovel}
            aoMudar={(x) => mudar('imovel', x)}
            erro={erros.imovel?.join(' ')}
            placeholder="Ex.: 10 T3 Maia"
          />
        )
      case 'descricao':
        return (
          <CampoAreaTexto rotulo="Descrição" value={v.descricao} onChange={(e) => mudar('descricao', e.target.value)} />
        )
    }
    return null
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Agenda"
        caminho="/agenda"
        referencia={compromisso?.referencia ?? 'Novo'}
        titulo={compromisso ? 'Editar compromisso' : 'Novo compromisso'}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <BlocosConfiguraveis
        def={ECRA_COMPROMISSO}
        modo="editar"
        personalizados={cp}
        campo={desenharCampo}
        erros={erros}
      />
      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(compromisso ? `/agenda/compromissos/${compromisso.id}` : '/agenda')}
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
