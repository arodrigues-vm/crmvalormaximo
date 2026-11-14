import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

import { Dialogo } from './Dialogo'

/**
 * Avisa antes de sair com alterações por guardar (navegação interna e fecho do separador).
 * Depois de gravar com sucesso, chamar `libertar()` antes de navegar.
 */
export function useGuardaSaida(alterado: boolean) {
  const ativo = useRef(alterado)
  useEffect(() => {
    ativo.current = alterado
  }, [alterado])

  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) => ativo.current && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!alterado) return
    const aviso = (e: BeforeUnloadEvent) => {
      if (ativo.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [alterado])

  const libertar = useCallback(() => {
    ativo.current = false
  }, [])

  const dialogo = (
    <Dialogo
      titulo="Alterações por guardar"
      aberto={bloqueio.state === 'blocked'}
      aoFechar={() => bloqueio.reset?.()}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={() => bloqueio.reset?.()}>
            Continuar a editar
          </button>
          <button type="button" className="botao-perigo" onClick={() => bloqueio.proceed?.()}>
            Sair sem guardar
          </button>
        </>
      }
    >
      <p>Tem alterações que ainda não foram guardadas. Se sair agora, serão perdidas.</p>
    </Dialogo>
  )
  return { dialogo, libertar }
}
