import type { ReactNode } from 'react'

export function PaginaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="pagina-publica">
      <img
        className="logotipo-publico"
        src="/marca/logotipo-640.webp"
        alt="Valor Máximo — Soluções Imobiliárias"
        width={220}
        height={172}
      />
      <div className="caixa-publica">
        <h1>{titulo}</h1>
        {children}
      </div>
      <p className="rodape-publico">A sua casa, o meu compromisso</p>
    </div>
  )
}
