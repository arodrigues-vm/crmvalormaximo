import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ErroApi, pedido } from '../api/cliente'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from './campos'
import { momentoPt } from './formatar'

interface Interacao {
  id: number
  tipo: number
  tipo_nome: string
  momento: string
  resumo: string
  criado_por: string
  anulada: boolean
  editada_em: string | null
  editada_por: string | null
}

const paraLocal = (d: Date) => {
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}
const agoraLocal = () => paraLocal(new Date())

/**
 * Diário de contactos (chamadas, reuniões…). Pode corrigir-se (D-42) — o texto anterior fica na auditoria —
 * ou anular-se (fica riscado). Não se apaga.
 */
export function Interacoes({
  base,
  podeEditar,
  tipos,
}: {
  base: string
  podeEditar: boolean
  tipos: { id: number; nome: string }[]
}) {
  const qc = useQueryClient()
  const chave = ['interacoes', base]
  const { data = [], isLoading } = useQuery({ queryKey: chave, queryFn: () => pedido<Interacao[]>(base) })
  const [aAdicionar, setAAdicionar] = useState(false)
  const [aEditar, setAEditar] = useState<number | null>(null)
  const [tipo, setTipo] = useState('')
  const [momento, setMomento] = useState(agoraLocal())
  const [resumo, setResumo] = useState('')
  const [erros, setErros] = useState<Record<string, string[]>>({})

  const criar = useMutation({
    mutationFn: () => {
      const corpo = { tipo: Number(tipo), momento: new Date(momento).toISOString(), resumo }
      return aEditar
        ? pedido<Interacao[]>(`${base}${aEditar}/`, { method: 'PATCH', json: corpo })
        : pedido<Interacao[]>(base, { json: corpo })
    },
    onSuccess: (l) => {
      qc.setQueryData(chave, l)
      setAAdicionar(false)
      setAEditar(null)
      setTipo('')
      setResumo('')
      setMomento(agoraLocal())
      setErros({})
    },
    onError: (e) => setErros(e instanceof ErroApi ? e.campos : { resumo: ['Não foi possível gravar.'] }),
  })
  const anular = useMutation({
    mutationFn: (id: number) => pedido<Interacao[]>(`${base}${id}/anular/`, { method: 'POST' }),
    onSuccess: (l) => qc.setQueryData(chave, l),
  })

  function submeter(e: FormEvent) {
    e.preventDefault()
    if (!tipo || !resumo.trim()) {
      setErros({
        ...(tipo ? {} : { tipo: ['Escolha o tipo.'] }),
        ...(resumo.trim() ? {} : { resumo: ['Escreva um resumo.'] }),
      })
      return
    }
    criar.mutate()
  }

  if (isLoading) return <p className="ajuda">A carregar…</p>
  return (
    <div>
      {podeEditar && !aAdicionar && (
        <button type="button" className="botao-secundario" onClick={() => setAAdicionar(true)}>
          + Registar contacto
        </button>
      )}
      {aAdicionar && (
        <form className="nova-relacao" onSubmit={submeter}>
          <CampoSelecao
            rotulo="Tipo"
            vazio="—"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            opcoes={tipos.map((t) => ({ valor: t.id, nome: t.nome }))}
            erro={erros.tipo}
          />
          <CampoTexto
            rotulo="Quando"
            type="datetime-local"
            value={momento}
            onChange={(e) => setMomento(e.target.value)}
            erro={erros.momento}
          />
          <CampoAreaTexto
            rotulo="Resumo"
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            erro={erros.resumo}
            placeholder="O que foi falado, combinado ou decidido."
          />
          <div className="acoes-formulario largo">
            <button
              type="button"
              className="botao-secundario"
              onClick={() => {
                setAAdicionar(false)
                setAEditar(null)
                setTipo('')
                setResumo('')
                setMomento(agoraLocal())
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="botao-principal" disabled={criar.isPending}>
              {aEditar ? 'Guardar' : 'Registar'}
            </button>
          </div>
        </form>
      )}
      {data.length === 0 && !aAdicionar && <p className="ajuda">Sem contactos registados.</p>}
      {data.length > 0 && (
        <ol className="historico interacoes">
          {data.map((i) => (
            <li key={i.id} className={i.anulada ? 'anulada' : ''}>
              <div className="historico-cabecalho">
                <strong>{i.tipo_nome}</strong> · {momentoPt(i.momento)} · {i.criado_por}
                {i.anulada && <span className="etiqueta etiqueta-neutra">Anulado</span>}
                {i.editada_em && (
                  <small className="ajuda">
                    {' '}
                    (corrigido por {i.editada_por} em {momentoPt(i.editada_em)})
                  </small>
                )}
                {podeEditar && (
                  <button
                    type="button"
                    className="ligacao-botao"
                    onClick={() => {
                      setTipo(String(i.tipo))
                      setMomento(paraLocal(new Date(i.momento)))
                      setResumo(i.resumo)
                      setErros({})
                      setAEditar(i.id)
                      setAAdicionar(true)
                    }}
                  >
                    Editar
                  </button>
                )}
                {podeEditar && !i.anulada && (
                  <button
                    type="button"
                    className="ligacao-botao"
                    onClick={() => {
                      if (window.confirm('Anular este registo? Fica riscado, mas não é apagado.')) anular.mutate(i.id)
                    }}
                  >
                    Anular
                  </button>
                )}
              </div>
              <p className="texto-livre">{i.resumo}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
