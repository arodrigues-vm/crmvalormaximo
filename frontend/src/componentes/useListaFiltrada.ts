import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Estado da lista (filtros, pesquisa com atraso, página) guardado no endereço da página. */
export function useListaFiltrada() {
  const [params, setParams] = useSearchParams()
  const [termo, setTermo] = useState(params.get('pesquisa') ?? '')

  function mudar(novos: Record<string, string>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('pesquisa') ?? '') !== termo) mudar({ pesquisa: termo, page: '' })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo])

  return {
    params,
    mudar,
    termo,
    setTermo,
    pagina: Number(params.get('page') ?? '1'),
    consulta: Object.fromEntries(params.entries()),
  }
}
