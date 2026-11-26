import { NavLink } from 'react-router-dom'

/** Separadores do módulo Faturação e Comissões. */
export function NavegacaoFaturacao() {
  return (
    <nav className="separadores" aria-label="Faturação e Comissões">
      <NavLink to="/faturacao" end>
        Comissões
      </NavLink>
      <NavLink to="/faturacao/documentos">Documentos e pagamentos dos consultores</NavLink>
    </nav>
  )
}
