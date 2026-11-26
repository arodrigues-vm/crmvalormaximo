import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { CAMINHOS, comoRegistoCp, procurarRegistos, usePersonalizados } from '../../componentes/personalizados'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { transacoesApi } from '../transacoes/api'
import { tarefasApi, type Tarefa } from './api'
import { ECRA_TAREFA } from './disposicao'

type Valores = Record<
  'titulo' | 'descricao' | 'transacao' | 'categoria' | 'prioridade' | 'prazo' | 'responsavel' | 'origem_modulo',
  string
> & { origem: OpcaoPesquisa | null }

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))

/** Nova tarefa: de pós-venda (menu Pós-Venda ou ficha da transação) ou geral (menu Tarefas ou outra ficha). */
export function TarefaNova({ posVenda = false }: { posVenda?: boolean }) {
  const [p] = useSearchParams()
  const origemModulo = p.get('origem_modulo') ?? ''
  const origemId = p.get('origem_id')
  return (
    <Formulario
      posVenda={posVenda}
      inicial={{
        titulo: '',
        descricao: '',
        transacao: posVenda ? (p.get('transacao') ?? '') : '',
        categoria: '',
        prioridade: '',
        prazo: '',
        responsavel: '',
        origem_modulo: origemModulo,
        origem: origemId ? { id: Number(origemId), titulo: p.get('origem_titulo') ?? `Registo ${origemId}` } : null,
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
      posVenda={data.pos_venda}
      inicial={{
        titulo: data.titulo,
        descricao: data.descricao,
        transacao: t(data.transacao),
        categoria: t(data.categoria),
        prioridade: t(data.prioridade),
        prazo: t(data.prazo),
        responsavel: String(data.responsavel),
        origem_modulo: data.origem_modulo,
        origem: data.origem ? { id: data.origem.id, titulo: data.origem.titulo } : null,
      }}
    />
  )
}

function Formulario({ tarefa, posVenda, inicial }: { tarefa?: Tarefa; posVenda: boolean; inicial: Valores }) {
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
    enabled: !tarefa && posVenda,
  })
  const mudar = (k: Exclude<keyof Valores, 'origem'>, x: string) => setV((a) => ({ ...a, [k]: x }))
  // A ficha de origem, quando a tarefa nasce de uma ficha (ex.: «+ Nova tarefa» na entidade), fica fixa.
  const origemFixa = !tarefa && !!inicial.origem
  const base = posVenda ? '/pos-venda' : '/tarefas'
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
      categoria: num(v.categoria),
      prioridade: num(v.prioridade),
      prazo: v.prazo || null,
      responsavel: v.responsavel ? Number(v.responsavel) : undefined,
      campos_personalizados: cp.paraApi(),
    }
    if (posVenda) corpo.transacao = num(v.transacao)
    else {
      corpo.origem_modulo = v.origem ? v.origem_modulo : ''
      corpo.origem_id = v.origem && v.origem_modulo ? v.origem.id : null
    }
    try {
      const r = tarefa
        ? await tarefasApi.atualizar(tarefa.id, { ...corpo, versao: tarefa.versao })
        : await tarefasApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      qc.setQueryData(['tarefas', String(r.id)], r)
      navegar(`${base}/${r.id}`, { replace: !tarefa })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos as Record<string, string[]>)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  const lista = (k: 'categoria' | 'prioridade', rotulo: string, valores: { id: number; nome: string }[] = []) => (
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
            disabled={tarefa?.marketing}
            ajuda={tarefa?.marketing ? 'Designação original do catálogo do plano (não se altera).' : undefined}
            value={v.titulo}
            onChange={(e) => mudar('titulo', e.target.value)}
            erro={erros.titulo}
          />
        )
      case 'origem':
        if (posVenda || tarefa?.marketing) return null
        return origemFixa ? (
          <CampoTexto rotulo="Ligada a" value={v.origem?.titulo ?? ''} disabled readOnly />
        ) : (
          <>
            <CampoSelecao
              rotulo="Ligada a (módulo)"
              vazio="— (tarefa solta, sem ficha)"
              value={v.origem_modulo}
              onChange={(e) => setV((a) => ({ ...a, origem_modulo: e.target.value, origem: null }))}
              opcoes={(o?.origens ?? []).map((x) => ({ valor: x.valor, nome: x.nome }))}
              erro={erros.origem_modulo}
            />
            {v.origem_modulo && (
              <SeletorPesquisavel
                key={v.origem_modulo}
                rotulo="Registo"
                chave={`origem-${v.origem_modulo}`}
                procurar={procurarRegistos(v.origem_modulo)}
                valor={v.origem}
                aoMudar={(x) => setV((a) => ({ ...a, origem: x }))}
                erro={erros.origem_id?.join(' ')}
              />
            )}
          </>
        )
      case 'transacao':
        if (!posVenda) return null
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
            modulo={posVenda ? 'pos-venda' : 'tarefas'}
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
        modulo={posVenda ? 'Pós-Venda' : 'Tarefas'}
        caminho={base}
        referencia={tarefa?.referencia ?? 'Nova'}
        titulo={tarefa ? 'Editar tarefa' : posVenda ? 'Nova tarefa de pós-venda' : 'Nova tarefa'}
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
            navegar(
              tarefa
                ? `${base}/${tarefa.id}`
                : v.transacao
                  ? `/transacoes/${v.transacao}`
                  : origemFixa && v.origem
                    ? `${CAMINHOS[v.origem_modulo]}/${v.origem.id}`
                    : base,
            )
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
