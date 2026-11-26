import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Dialogo } from '../../componentes/Dialogo'
import { dataPt } from '../../componentes/formatar'
import { ETIQUETA_TAREFA, tarefasApi } from './api'

/** Bloco «Pós-venda» da ficha da transação concluída (D-50): tarefas e propostas a partir dos modelos. */
export function PosVendaTransacao({ transacao, podeCriar }: { transacao: number; podeCriar: boolean }) {
  const qc = useQueryClient()
  const [aPropor, setAPropor] = useState(false)
  const lista = useQuery({
    queryKey: ['tarefas', 'lista', { transacao: String(transacao), vista: 'todas' }],
    queryFn: () => tarefasApi.listar({ transacao: String(transacao), vista: 'todas' }),
  })
  const tarefas = lista.data?.results ?? []
  return (
    <div>
      {lista.isLoading && <p className="ajuda">A carregar…</p>}
      {lista.data && tarefas.length === 0 && <p className="ajuda">Sem tarefas de pós-venda.</p>}
      {tarefas.length > 0 && (
        <ul className="lista-relacoes">
          {tarefas.map((x) => (
            <li key={x.id}>
              <Link to={`/pos-venda/${x.id}`}>{x.titulo}</Link>
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
          <Link to={`/pos-venda/nova?transacao=${transacao}`} className="botao-secundario">
            + Nova tarefa
          </Link>
        </div>
      )}
      {aPropor && (
        <DialogoPropor
          transacao={transacao}
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

function DialogoPropor({
  transacao,
  aoFechar,
  aoCriar,
}: {
  transacao: number
  aoFechar: () => void
  aoCriar: () => void
}) {
  const proposta = useQuery({
    queryKey: ['tarefas', 'proposta', transacao],
    queryFn: () => tarefasApi.proposta(transacao),
    gcTime: 0,
  })
  const [escolhidos, setEscolhidos] = useState<number[] | null>(null)
  const marcados = escolhidos ?? (proposta.data ?? []).map((m) => m.id)
  const criar = useMutation({ mutationFn: () => tarefasApi.criarDeModelos(transacao, marcados), onSuccess: aoCriar })
  const alternar = (id: number) =>
    setEscolhidos(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id])
  return (
    <Dialogo
      titulo="Propor tarefas de pós-venda"
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
      {proposta.data?.length === 0 && <p className="ajuda">Todos os modelos ativos já foram usados nesta transação.</p>}
      {!!proposta.data?.length && (
        <>
          <p className="ajuda">O prazo de cada tarefa conta a partir da data da escritura / contrato.</p>
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
