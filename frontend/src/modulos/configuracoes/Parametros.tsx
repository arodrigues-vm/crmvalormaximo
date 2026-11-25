import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ErroApi, pedido } from '../../api/cliente'
import { useSessao } from '../../app/sessao'

interface Parametro {
  chave: string
  nome: string
  descricao: string
  modulo: string
  valor: unknown
}

/** Parâmetros de funcionamento (limiares de aviso do CMI, início de sessão em dois passos…). */
export function Parametros() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({
    queryKey: ['parametros'],
    queryFn: () => pedido<Parametro[]>('/api/parametros/'),
  })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  return (
    <section className="bloco configuracao-lista">
      <div className="bloco-conteudo">
        <h2 className="ficha-titulo">Parâmetros</h2>
        {data.map((p) =>
          typeof p.valor === 'boolean' ? (
            <ParametroSimNao
              key={p.chave}
              p={p}
              aoGravar={(n) =>
                qc.setQueryData(
                  ['parametros'],
                  data.map((x) => (x.chave === n.chave ? n : x)),
                )
              }
            />
          ) : p.chave === 'cmi_alertas_dias' ? (
            <ParametroDias
              key={p.chave}
              p={p}
              aoGravar={(n) =>
                qc.setQueryData(
                  ['parametros'],
                  data.map((x) => (x.chave === n.chave ? n : x)),
                )
              }
            />
          ) : null,
        )}
      </div>
    </section>
  )
}

function ParametroDias({ p, aoGravar }: { p: Parametro; aoGravar: (p: Parametro) => void }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState((p.valor as number[]).join(', '))
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const gravar = useMutation({
    mutationFn: () =>
      pedido<Parametro>(`/api/parametros/${p.chave}/`, {
        method: 'PATCH',
        json: { valor: texto.split(/[\s,;]+/).filter(Boolean) },
      }),
    onSuccess: (n) => {
      aoGravar(n)
      setTexto((n.valor as number[]).join(', '))
      setErro(null)
      setOk(true)
      qc.invalidateQueries({ queryKey: ['angariacoes'] })
    },
    onError: (e) => {
      setOk(false)
      setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falha ao gravar.')
    },
  })
  return (
    <div className="parametro">
      <label htmlFor={`p-${p.chave}`}>
        <strong>{p.nome}</strong>
      </label>
      <p className="ajuda">{p.descricao} Separe os valores por vírgulas.</p>
      <div className="valor-novo">
        <input
          id={`p-${p.chave}`}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setOk(false)
          }}
        />
        <button type="button" className="botao-principal" disabled={gravar.isPending} onClick={() => gravar.mutate()}>
          Guardar
        </button>
      </div>
      {ok && <p className="ajuda">Guardado.</p>}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}

function ParametroSimNao({ p, aoGravar }: { p: Parametro; aoGravar: (p: Parametro) => void }) {
  const { atualizar } = useSessao()
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const gravar = useMutation({
    mutationFn: (valor: boolean) =>
      pedido<Parametro>(`/api/parametros/${p.chave}/`, { method: 'PATCH', json: { valor } }),
    onSuccess: (n) => {
      aoGravar(n)
      setErro(null)
      setOk(true)
      void atualizar()
    },
    onError: (e) => {
      setOk(false)
      setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falha ao gravar.')
    },
  })
  return (
    <div className="parametro">
      <label htmlFor={`p-${p.chave}`}>
        <strong>{p.nome}</strong>
      </label>
      <p className="ajuda">{p.descricao}</p>
      <div className="valor-novo">
        <select
          id={`p-${p.chave}`}
          value={p.valor ? 'sim' : 'nao'}
          disabled={gravar.isPending}
          onChange={(e) => gravar.mutate(e.target.value === 'sim')}
        >
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      </div>
      {ok && <p className="ajuda">Guardado.</p>}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
