import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { transacoesApi } from '../transacoes/api'
import { tarefasApi, type Tarefa } from './api'
import { ECRA_TAREFA } from './disposicao'

type Valores = Record<
  'titulo' | 'descricao' | 'transacao' | 'categoria' | 'estado' | 'prioridade' | 'prazo' | 'responsavel',
  string
>

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))

export function TarefaNova() {
  const [p] = useSearchParams()
  return (
    <Formulario
      inicial={{
        titulo: '',
        descricao: '',
        transacao: p.get('transacao') ?? '',
        categoria: '',
        estado: '',
        prioridade: '',
        prazo: '',
        responsavel: '',
      }}
    />
  )
}

export function TarefaEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['tarefas', id], queryFn: () => tarefasApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Tarefa não encontrada ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta tarefa.</p>
  return (
    <Formulario
      key={data.versao}
      tarefa={data}
      inicial={{
        titulo: data.titulo,
        descricao: data.descricao,
        transacao: String(data.transacao),
        categoria: t(data.categoria),
        estado: t(data.estado),
        prioridade: t(data.prioridade),
        prazo: t(data.prazo),
        responsavel: String(data.responsavel),
      }}
    />
  )
}

function Formulario({ tarefa, inicial }: { tarefa?: Tarefa; inicial: Valores }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const base0 = useMemo(() => inicial, [inicial])
  const [v, setV] = useState(base0)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const cp = usePersonalizados(ECRA_TAREFA, comoRegistoCp(tarefa))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(base0) || cp.alterado)
  const opcoes = useQuery({ queryKey: ['tarefas', 'opcoes'], queryFn: tarefasApi.opcoes, staleTime: 60_000 })
  // Só transações concluídas recebem tarefas de pós-venda (o servidor volta a verificar).
  const transacoes = useQuery({
    queryKey: ['transacoes', 'lista', { categoria: 'concluida', page_size: 'todas' }],
    queryFn: () => transacoesApi.listar({ categoria: 'concluida' }),
    enabled: !tarefa,
  })
  const mudar = (k: keyof Valores, x: string) => setV((a) => ({ ...a, [k]: x }))
  const o = opcoes.data
  const num = (x: string) => (x ? Number(x) : null)

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo: Record<string, unknown> = {
      titulo: v.titulo,
      descricao: v.descricao,
      transacao: num(v.transacao),
      categoria: num(v.categoria),
      estado: num(v.estado),
      prioridade: num(v.prioridade),
      prazo: v.prazo || null,
      responsavel: v.responsavel ? Number(v.responsavel) : undefined,
      campos_personalizados: cp.paraApi(),
    }
    try {
      const r = tarefa
        ? await tarefasApi.atualizar(tarefa.id, { ...corpo, versao: tarefa.versao })
        : await tarefasApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      qc.setQueryData(['tarefas', String(r.id)], r)
      navegar(`/pos-venda/${r.id}`, { replace: !tarefa })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos as Record<string, string[]>)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  const lista = (
    k: 'categoria' | 'estado' | 'prioridade',
    rotulo: string,
    valores: { id: number; nome: string }[] = [],
  ) => (
    <CampoSelecao
      rotulo={rotulo}
      vazio="—"
      value={v[k]}
      onChange={(e) => mudar(k, e.target.value)}
      opcoes={valores.map((x) => ({ valor: x.id, nome: x.nome }))}
      erro={erros[k]}
    />
  )
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
      case 'transacao':
        return tarefa ? (
          <CampoTexto rotulo="Transação" value={tarefa.transacao_referencia ?? ''} disabled readOnly />
        ) : (
          <CampoSelecao
            rotulo="Transação"
            required
            vazio="—"
            value={v.transacao}
            onChange={(e) => mudar('transacao', e.target.value)}
            opcoes={(transacoes.data?.results ?? []).map((x) => ({
              valor: x.id,
              nome: `${x.referencia} · ${x.entidade_nome ?? ''} · ${x.imovel_descricao_completa}`,
            }))}
            erro={erros.transacao}
            ajuda="Só transações concluídas."
          />
        )
      case 'estado':
        return lista('estado', 'Estado', o?.estados)
      case 'prioridade':
        return lista('prioridade', 'Prioridade', o?.prioridades)
      case 'categoria':
        return lista('categoria', 'Categoria', o?.categorias)
      case 'prazo':
        return (
          <CampoTexto
            rotulo="Prazo"
            type="date"
            value={v.prazo}
            onChange={(e) => mudar('prazo', e.target.value)}
            erro={erros.prazo}
          />
        )
      case 'responsavel':
        return (
          <CampoResponsavel
            modulo="pos-venda"
            valor={v.responsavel}
            atual={tarefa ? { id: tarefa.responsavel, nome: tarefa.responsavel_nome } : null}
            aoMudar={(x) => mudar('responsavel', x)}
            erro={erros.responsavel}
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
        modulo="Pós-Venda"
        caminho="/pos-venda"
        referencia={tarefa?.referencia ?? 'Nova'}
        titulo={tarefa ? 'Editar tarefa' : 'Nova tarefa de pós-venda'}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <BlocosConfiguraveis def={ECRA_TAREFA} modo="editar" personalizados={cp} campo={desenharCampo} erros={erros} />
      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() =>
            navegar(tarefa ? `/pos-venda/${tarefa.id}` : v.transacao ? `/transacoes/${v.transacao}` : '/pos-venda')
          }
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
