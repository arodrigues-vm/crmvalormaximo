import { createContext, useContext } from 'react'

/** Nome escolhido pelo Administrador para o campo que está a ser desenhado (D-44). `null` = nome de origem. */
export const RotuloCtx = createContext<string | null>(null)

/** Devolve o nome do campo: o escolhido pelo Administrador, se existir; senão, o de origem. */
export function useRotulo(original: string) {
  return useContext(RotuloCtx) ?? original
}
