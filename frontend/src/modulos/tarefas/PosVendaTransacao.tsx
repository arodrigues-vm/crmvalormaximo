import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Dialogo } from '../../componentes/Dialogo'
import { dataPt } from '../../componentes/formatar'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { caminhoTarefa, ETIQUETA_TAREFA, tarefasApi, type AlvoModelos } from './api'

/** Bloco «Pós-venda» da ficha da transação concluída (D-50): tarefas e propostas a partir dos modelos. */
export function PosVendaTransacao({ transacao, podeCriar }: { transacao: number; podeCriar: boolean }) {
  return (
    <TarefasDaFicha
      alvo={{ transacao }}
      filtro={{ transacao: String(transacao) }}
      podeCriar={podeCriar}
      novaHref={`/pos-venda/nova?transacao=${transacao}`}
      vazio="Sem tarefas de pós-venda."
    />
  )
}

/** Bloco «Tarefas» das fichas dos módulos comerciais (D-52). */
export function TarefasOrigem({ modulo, id }: { modulo: string; id: number }) {
  const { pode } = useSessao()
  if (!pode('tarefas')) return null
  return (
    <Bloco titulo="Tarefas">
      <TarefasDaFicha
        alvo={{ origem_modulo: modulo, origem_id: id }}
        filtro={{ origem_modulo: modulo, origem_id: String(id) }}
        podeCriar={pode('tarefas', 'criar')}
        novaHref={`/tarefas/nova?origem_modulo=${modulo}&origem_id=${id}`}
        vazio="Sem tarefas."
      />
    </Bloco>
  )
}

function TarefasDaFicha({
  alvo,
  filtro,
  podeCriar,
  novaHref,
  vazio,
}: {
  alvo: AlvoModelos
  filtro: Record<string, string>
  podeCriar: boolean
  novaHref: string
  vazio: string
}) {
  const qc = useQueryClient()
  const [aPropor, setAPropor] = useState(false)
  const pedidoLista = { ...filtro, vista: 'todas' }
  const lista = useQuery({
    queryKey: ['tarefas', 'lista', pedidoLista],
    queryFn: () => tarefasApi.listar(pedidoLista),
  })
  const tarefas = lista.data?.results ?? []
  return (
    <div>
      {lista.isLoading && <p className="ajuda">A carregar…</p>}
      {lista.data && tarefas.length === 0 && <p className="ajuda">{vazio}</p>}
      {tarefas.length > 0 && (
        <ul className="lista-relacoes">
          {tarefas.map((x) => (
            <li key={x.id}>
              <Link to={caminhoTarefa(x)}>{x.titulo}</Link>
              <span className="relacao-tipo">
                {x.prazo ? `Prazo: ${dataPt(x.prazo)}` : 'Sem prazo'} · {x.responsavel_nome}
              </span>
              {x.estado_nome && (
                <span className={`etiqueta etiqueta-${ETIQUETA_TAREFA[x.estado_categoria ?? ''] ?? 'neutra'}`}>
                  {x.estado_nome}
                </span>
              )}
              {x.atrasada && <span className="etiqueta etiqueta-perigo">Atrasada</span>}
            </li>
          ))}
        </ul>
      )}
      {podeCriar && (
        <div className="acoes-formulario">
          <button type="button" className="botao-secundario" onClick={() => setAPropor(true)}>
            Propor tarefas dos modelos
          </button>
          <Link to={novaHref} className="botao-secundario">
            + Nova tarefa
          </Link>
        </div>
      )}
      {aPropor && (
        <DialogoPropor
          alvo={alvo}
          aoFechar={() => setAPropor(false)}
          aoCriar={() => {
            qc.invalidateQueries({ queryKey: ['tarefas'] })
            setAPropor(false)
          }}
        />
      )}
    </div>
  )
}

function DialogoPropor({ alvo, aoFechar, aoCriar }: { alvo: AlvoModelos; aoFechar: () => void; aoCriar: () => void }) {
  const proposta = useQuery({
    queryKey: ['tarefas', 'proposta', alvo],
    queryFn: () => tarefasApi.proposta(alvo),
    gcTime: 0,
  })
  const [escolhidos, setEscolhidos] = useState<number[] | null>(null)
  const marcados = escolhidos ?? (proposta.data ?? []).map((m) => m.id)
  const criar = useMutation({ mutationFn: () => tarefasApi.criarDeModelos(alvo, marcados), onSuccess: aoCriar })
  const alternar = (id: number) =>
    setEscolhidos(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id])
  const posVenda = 'transacao' in alvo
  return (
    <Dialogo
      titulo={posVenda ? 'Propor tarefas de pós-venda' : 'Propor tarefas dos modelos'}
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            className="botao-principal"
            disabled={criar.isPending || marcados.length === 0}
            onClick={() => criar.mutate()}
          >
            Criar as tarefas marcadas
          </button>
        </>
      }
    >
      {proposta.isLoading && <p className="ajuda">A carregar…</p>}
      {proposta.data?.length === 0 && (
        <p className="ajuda">
          Não há modelos por usar{posVenda ? ' nesta transação' : ' para esta ficha'}. Os modelos criam-se em
          Configurações → Modelos de tarefas.
        </p>
      )}
      {!!proposta.data?.length && (
        <>
          <p className="ajuda">
            {posVenda
              ? 'O prazo de cada tarefa conta a partir da data da escritura / contrato.'
              : 'O prazo de cada tarefa conta a partir de hoje.'}
          </p>
          <fieldset className="efeitos-propostos">
            <legend>Tarefas a criar (só as marcadas)</legend>
            {proposta.data.map((m) => (
              <label key={m.id} className="efeito-opcao">
                <input type="checkbox" checked={marcados.includes(m.id)} onChange={() => alternar(m.id)} />
                {m.nome} <small className="ajuda">· {m.dias_apos} dias depois</small>
              </label>
            ))}
          </fieldset>
        </>
      )}
      {(proposta.error || criar.error) && (
        <p className="erro" role="alert">
          {(proposta.error ?? criar.error) instanceof ErroApi
            ? ((proposta.error ?? criar.error) as ErroApi).message
            : 'Não foi possível concluir.'}
        </p>
      )}
    </Dialogo>
  )
}

/** Lista de verificação dos documentos do negócio, por tipo (D-50). */
export function DocumentosNegocio({ transacao }: { transacao: number }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['transacoes', transacao, 'documentos'],
    queryFn: () => tarefasApi.documentos(transacao),
  })
  if (isLoading) return <p className="ajuda">A carregar…</p>
  if (!data.length) return null
  return (
    <ul className="lista-verificacao" aria-label="Documentos do negócio">
      {data.map((d) => (
        <li key={d.tipo}>
          <span aria-hidden>{d.ligacoes.length ? '✓' : '○'}</span> <strong>{d.nome}</strong>{' '}
          {d.ligacoes.length ? (
            d.ligacoes.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="ligacao-documento">
                {l.titulo} ↗
              </a>
            ))
          ) : (
            <small className="ajuda">em falta</small>
          )}
        </li>
      ))}
    </ul>
  )
}
