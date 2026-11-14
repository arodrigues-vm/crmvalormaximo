import type { ReactNode } from 'react'

export function PaginaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="pagina-publica">
      <div className="caixa-publica">
        <div className="marca marca-publica">
          <span className="marca-logo" aria-hidden="true">
            VM
          </span>
          <span className="marca-texto">
            <strong>Valor Máximo</strong>
            <small>Soluções Imobiliárias</small>
          </span>
        </div>
        <h1>{titulo}</h1>
        {children}
      </div>
      <p className="rodape-publico">A sua casa, o meu compromisso</p>
    </div>
  )
}
