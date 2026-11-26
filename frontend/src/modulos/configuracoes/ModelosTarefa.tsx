import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ErroApi } from '../../api/cliente'
import { CampoTexto } from '../../componentes/campos'
import { modelosTarefaApi, tarefasApi, type ModeloTarefa } from '../tarefas/api'

type Valores = { nome: string; descricao: string; dias_apos: string; ordem: string }
const VAZIO: Valores = { nome: '', descricao: '', dias_apos: '0', ordem: '0' }

/** Modelos de tarefa por módulo (D-50, D-52): propostos ao concluir a transação (pós-venda) ou na ficha
 * de cada módulo («Propor tarefas dos modelos»). Só se criam as tarefas confirmadas. */
export function ModelosTarefa() {
  const qc = useQueryClient()
  const [modulo, setModulo] = useState('pos-venda')
  const { data: todos = [], isLoading } = useQuery({ queryKey: ['modelos-tarefa'], queryFn: modelosTarefaApi.listar })
  const opcoes = useQuery({ queryKey: ['tarefas', 'opcoes'], queryFn: tarefasApi.opcoes, staleTime: 60_000 })
  const data = todos.filter((m) => m.modulo === modulo)
  const [aEditar, setAEditar] = useState<number | 'novo' | null>(null)
  const [v, setV] = useState<Valores>(VAZIO)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const gravar = useMutation({
    mutationFn: (dados: Record<string, unknown>) =>
      aEditar === 'novo' || aEditar === null
        ? modelosTarefaApi.criar(dados)
        : modelosTarefaApi.atualizar(aEditar, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelos-tarefa'] })
      setAEditar(null)
      setErros({})
    },
    onError: (e) => setErros(e instanceof ErroApi ? e.campos : { nome: ['Não foi possível gravar.'] }),
  })
  const ativar = useMutation({
    mutationFn: (m: ModeloTarefa) => modelosTarefaApi.atualizar(m.id, { ativo: !m.ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modelos-tarefa'] }),
  })
  const abrir = (m?: ModeloTarefa) => {
    setV(m ? { nome: m.nome, descricao: m.descricao, dias_apos: String(m.dias_apos), ordem: String(m.ordem) } : VAZIO)
    setErros({})
    setAEditar(m ? m.id : 'novo')
  }
  function submeter(e: FormEvent) {
    e.preventDefault()
    gravar.mutate({
      modulo,
      nome: v.nome,
      descricao: v.descricao,
      dias_apos: Number(v.dias_apos),
      ordem: Number(v.ordem),
    })
  }
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  const formulario = (
    <form className="nova-relacao" onSubmit={submeter}>
      <CampoTexto
        rotulo="Nome da tarefa"
        value={v.nome}
        onChange={(e) => setV({ ...v, nome: e.target.value })}
        erro={erros.nome}
      />
      <CampoTexto
        rotulo={modulo === 'pos-venda' ? 'Dias depois da escritura / contrato' : 'Dias depois de criada'}
        type="number"
        min={0}
        value={v.dias_apos}
        onChange={(e) => setV({ ...v, dias_apos: e.target.value })}
        erro={erros.dias_apos}
      />
      <CampoTexto
        rotulo="Ordem"
        type="number"
        min={0}
        value={v.ordem}
        onChange={(e) => setV({ ...v, ordem: e.target.value })}
        erro={erros.ordem}
      />
      <CampoTexto
        rotulo="Descrição (passa para a tarefa)"
        largo
        value={v.descricao}
        onChange={(e) => setV({ ...v, descricao: e.target.value })}
        erro={erros.descricao}
      />
      <div className="acoes-formulario largo">
        <button type="button" className="botao-secundario" onClick={() => setAEditar(null)}>
          Cancelar
        </button>
        <button type="submit" className="botao-principal" disabled={gravar.isPending}>
          Guardar
        </button>
      </div>
    </form>
  )
  return (
    <section className="bloco configuracao-lista">
      <div className="bloco-conteudo">
        <h2 className="ficha-titulo">Modelos de tarefas</h2>
        <label className="campo-compacto">
          <span>Módulo</span>
          <select
            aria-label="Módulo"
            value={modulo}
            onChange={(e) => {
              setModulo(e.target.value)
              setAEditar(null)
            }}
          >
            {(opcoes.data?.modulos_modelo ?? [{ valor: 'pos-venda', nome: 'Pós-Venda' }]).map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <p className="ajuda">
          {modulo === 'pos-venda'
            ? 'Quando uma transação passa a «Concluída», o CRM propõe uma tarefa por cada modelo ativo; o prazo conta a partir da escritura / contrato.'
            : 'Na ficha deste módulo, «Propor tarefas dos modelos» mostra estes modelos; o prazo conta a partir do dia em que a tarefa é criada.'}{' '}
          Só se criam as tarefas confirmadas. Os modelos não se apagam: desative os que já não usa (as tarefas criadas
          mantêm-se).
        </p>
        <ul className="lista-relacoes">
          {data.map((m) =>
            aEditar === m.id ? (
              <li key={m.id}>{formulario}</li>
            ) : (
              <li key={m.id}>
                <strong>{m.nome}</strong>
                <span className="relacao-tipo">{m.dias_apos} dias depois</span>
                {!m.ativo && <span className="etiqueta etiqueta-neutra">Inativo</span>}
                <button type="button" className="ligacao-botao" onClick={() => abrir(m)}>
                  Editar
                </button>
                <button type="button" className="ligacao-botao" onClick={() => ativar.mutate(m)}>
                  {m.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </li>
            ),
          )}
        </ul>
        {aEditar === 'novo' ? (
          formulario
        ) : (
          <button type="button" className="botao-secundario" onClick={() => abrir()}>
            + Novo modelo
          </button>
        )}
      </div>
    </section>
  )
}
