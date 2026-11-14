import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ErroApi, pedido } from '../../api/cliente'

interface Parametro {
  chave: string
  nome: string
  descricao: string
  modulo: string
  valor: unknown
}

/** Parâmetros de funcionamento (por agora: limiares de aviso do CMI). */
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
          p.chave === 'cmi_alertas_dias' ? (
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
