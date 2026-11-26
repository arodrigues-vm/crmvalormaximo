import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ErroApi } from '../../api/cliente'
import { CampoTexto } from '../../componentes/campos'
import { modelosTarefaApi, type ModeloTarefa } from '../tarefas/api'

type Valores = { nome: string; descricao: string; dias_apos: string; ordem: string }
const VAZIO: Valores = { nome: '', descricao: '', dias_apos: '0', ordem: '0' }

/** Modelos de tarefa de pós-venda (D-50): propostos quando a transação fica «Concluída». */
export function ModelosTarefa() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['modelos-tarefa'], queryFn: modelosTarefaApi.listar })
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
    gravar.mutate({ nome: v.nome, descricao: v.descricao, dias_apos: Number(v.dias_apos), ordem: Number(v.ordem) })
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
        rotulo="Dias depois da escritura / contrato"
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
        <h2 className="ficha-titulo">Modelos de tarefas de pós-venda</h2>
        <p className="ajuda">
          Quando uma transação passa a «Concluída», o CRM propõe uma tarefa por cada modelo ativo; só se criam as que
          forem confirmadas. Os modelos não se apagam: desative os que já não usa (as tarefas criadas mantêm-se).
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
