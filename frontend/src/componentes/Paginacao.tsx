interface Props {
  pagina: number
  total: number
  porPagina: number
  aoMudar: (p: number) => void
}

export function Paginacao({ pagina, total, porPagina, aoMudar }: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (total === 0) return null
  const inicio = (pagina - 1) * porPagina + 1
  const fim = Math.min(total, pagina * porPagina)
  return (
    <nav className="paginacao" aria-label="Paginação">
      <span>
        {inicio}–{fim} de {total}
      </span>
      <button className="botao-secundario" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        ‹ Anterior
      </button>
      <button className="botao-secundario" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>
        Seguinte ›
      </button>
    </nav>
  )
}
