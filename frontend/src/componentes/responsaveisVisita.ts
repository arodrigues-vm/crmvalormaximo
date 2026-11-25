import { useQuery } from '@tanstack/react-query'

import { entidadesApi } from '../modulos/entidades/api'
import { imoveisApi } from '../modulos/imoveis/api'

/** Lê das fichas o que é preciso para mostrar os responsáveis. */
export function useResponsaveisDasFichas(imovel: number | null, entidade: number | null) {
  const i = useQuery({
    queryKey: ['imoveis', String(imovel)],
    queryFn: () => imoveisApi.obter(String(imovel)),
    enabled: !!imovel,
    staleTime: 30_000,
  })
  const e = useQuery({
    queryKey: ['entidades', String(entidade)],
    queryFn: () => entidadesApi.obter(String(entidade)),
    enabled: !!entidade,
    staleTime: 30_000,
  })
  return {
    imovel: i.data,
    entidade: e.data,
    clienteExterno: !!e.data?.cliente_externo,
  }
}
