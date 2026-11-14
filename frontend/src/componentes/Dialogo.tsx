import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  titulo: string
  aberto: boolean
  aoFechar: () => void
  children: ReactNode
  acoes: ReactNode
}

export function Dialogo({ titulo, aberto, aoFechar, children, acoes }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!aberto && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [aberto])
  return (
    <dialog ref={ref} className="dialogo" onCancel={aoFechar} aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{titulo}</h2>
      <div className="dialogo-corpo">{children}</div>
      <div className="dialogo-acoes">{acoes}</div>
    </dialog>
  )
}
