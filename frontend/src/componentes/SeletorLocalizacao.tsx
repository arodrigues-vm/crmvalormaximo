import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { pedido } from '../api/cliente'

interface Item {
  id: number
  nome: string
}
interface FreguesiaInfo {
  id: number
  nome: string
  concelho: string
  distrito: string
}

interface Props {
  freguesia: number | null
  /** Para mostrar a seleção atual sem pedidos extra. */
  atual?: { freguesia: string; concelho: string; distrito: string } | null
  aoMudar: (freguesia: number | null) => void
}

/** Distrito/Região Autónoma → Concelho → Freguesia (CAOP), com seletores dependentes. */
export function SeletorLocalizacao({ freguesia, atual, aoMudar }: Props) {
  const [distrito, setDistrito] = useState<number | ''>('')
  const [concelho, setConcelho] = useState<number | ''>('')
  const [aAlterar, setAAlterar] = useState(!freguesia)

  const distritos = useQuery({
    queryKey: ['loc', 'distritos'],
    queryFn: () => pedido<Item[]>('/api/localizacao/distritos/'),
    staleTime: Infinity,
  })
  const concelhos = useQuery({
    queryKey: ['loc', 'concelhos', distrito],
    queryFn: () => pedido<Item[]>(`/api/localizacao/concelhos/?distrito=${distrito}`),
    enabled: distrito !== '',
    staleTime: Infinity,
  })
  const freguesias = useQuery({
    queryKey: ['loc', 'freguesias', concelho],
    queryFn: () => pedido<FreguesiaInfo[]>(`/api/localizacao/freguesias/?concelho=${concelho}`),
    enabled: concelho !== '',
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!freguesia) setAAlterar(true)
  }, [freguesia])

  if (distritos.data && distritos.data.length === 0) {
    return (
      <p className="ajuda largo">
        O catálogo oficial de localizações (CAOP) ainda não foi carregado. Preencha a localidade e o código postal.
      </p>
    )
  }

  if (freguesia && atual && !aAlterar) {
    return (
      <div className="campo largo">
        <span className="rotulo-falso">Localização administrativa</span>
        <div className="localizacao-atual">
          <span>
            {atual.freguesia}, {atual.concelho}, {atual.distrito}
          </span>
          <button type="button" className="botao-secundario" onClick={() => setAAlterar(true)}>
            Alterar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="localizacao largo">
      <div className="campo">
        <label htmlFor="loc-distrito">Distrito / Região Autónoma</label>
        <select
          id="loc-distrito"
          value={distrito}
          onChange={(e) => {
            setDistrito(e.target.value ? Number(e.target.value) : '')
            setConcelho('')
            aoMudar(null)
          }}
        >
          <option value="">—</option>
          {distritos.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="loc-concelho">Concelho</label>
        <select
          id="loc-concelho"
          value={concelho}
          disabled={distrito === ''}
          onChange={(e) => {
            setConcelho(e.target.value ? Number(e.target.value) : '')
            aoMudar(null)
          }}
        >
          <option value="">—</option>
          {concelhos.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="loc-freguesia">Freguesia</label>
        <select
          id="loc-freguesia"
          value={freguesia ?? ''}
          disabled={concelho === ''}
          onChange={(e) => aoMudar(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">—</option>
          {freguesias.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
