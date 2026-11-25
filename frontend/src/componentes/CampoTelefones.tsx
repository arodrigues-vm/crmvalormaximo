import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { pedido } from '../api/cliente'
import { useRotulo } from './rotulo'

export interface TelefoneEditavel {
  id?: number
  regiao: string
  numero: string
  tipo: string
  principal: boolean
  numero_e164?: string
}

interface Pais {
  regiao: string
  indicativo: string
}

const nomesPaises = (() => {
  try {
    return new Intl.DisplayNames(['pt-PT'], { type: 'region' })
  } catch {
    return null
  }
})()

function usePaises() {
  const { data = [] } = useQuery({
    queryKey: ['telefone', 'paises'],
    queryFn: () => pedido<Pais[]>('/api/telefone/paises/'),
    staleTime: Infinity,
  })
  return useMemo(() => {
    const comNome = data.map((p) => ({ ...p, nome: nomesPaises?.of(p.regiao) ?? p.regiao }))
    comNome.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    // Portugal primeiro (valor inicial para novos contactos).
    return [...comNome.filter((p) => p.regiao === 'PT'), ...comNome.filter((p) => p.regiao !== 'PT')]
  }, [data])
}

interface Props {
  valores: TelefoneEditavel[]
  aoMudar: (v: TelefoneEditavel[]) => void
  tipos: { valor: string; nome: string }[]
  erros?: unknown
}

export function CampoTelefones({ valores, aoMudar, tipos, erros }: Props) {
  const paises = usePaises()
  const errosLinha = Array.isArray(erros) ? (erros as Record<string, string[]>[]) : []
  const erroGeral =
    typeof erros === 'string' ? erros : Array.isArray(erros) && typeof erros[0] === 'string' ? erros.join(' ') : null

  function alterar(i: number, parcial: Partial<TelefoneEditavel>) {
    aoMudar(
      valores.map((t, j) => {
        if (parcial.principal) return j === i ? { ...t, ...parcial } : { ...t, principal: false }
        return j === i ? { ...t, ...parcial } : t
      }),
    )
  }

  const legenda = useRotulo('Telefones')
  return (
    <fieldset className="campo largo telefones">
      <legend>{legenda}</legend>
      {valores.length === 0 && <p className="ajuda">Sem telefones.</p>}
      {valores.map((t, i) => (
        <div key={t.id ?? `novo-${i}`} className="telefone-linha">
          <select
            aria-label="País"
            value={t.regiao}
            onChange={(e) => alterar(i, { regiao: e.target.value })}
            className="telefone-pais"
          >
            {paises.map((p) => (
              <option key={p.regiao} value={p.regiao}>
                {p.nome} ({p.indicativo})
              </option>
            ))}
          </select>
          <input
            aria-label="Número"
            inputMode="tel"
            value={t.numero}
            onChange={(e) => alterar(i, { numero: e.target.value })}
            className="telefone-numero"
            aria-invalid={!!errosLinha[i]?.numero}
          />
          <select aria-label="Tipo" value={t.tipo} onChange={(e) => alterar(i, { tipo: e.target.value })}>
            {tipos.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.nome}
              </option>
            ))}
          </select>
          <label className="telefone-principal">
            <input
              type="radio"
              name="telefone-principal"
              checked={t.principal}
              onChange={() => alterar(i, { principal: true })}
            />
            Principal
          </label>
          <button
            type="button"
            className="botao-icone"
            aria-label="Remover telefone"
            onClick={() => aoMudar(valores.filter((_, j) => j !== i))}
          >
            ✕
          </button>
          {errosLinha[i]?.numero && (
            <small className="campo-erro" role="alert">
              {errosLinha[i].numero.join(' ')}
            </small>
          )}
        </div>
      ))}
      {erroGeral && (
        <small className="campo-erro" role="alert">
          {erroGeral}
        </small>
      )}
      <button
        type="button"
        className="botao-secundario"
        onClick={() =>
          aoMudar([...valores, { regiao: 'PT', numero: '', tipo: 'movel', principal: valores.length === 0 }])
        }
      >
        + Adicionar telefone
      </button>
    </fieldset>
  )
}
