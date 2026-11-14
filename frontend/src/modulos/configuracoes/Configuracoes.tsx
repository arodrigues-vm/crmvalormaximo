import { NavLink, Outlet } from 'react-router-dom'

export function Configuracoes() {
  return (
    <div className="pagina-lista">
      <div className="separadores" role="tablist" aria-label="Configurações">
        <NavLink to="/configuracoes/listas" role="tab">
          Listas de valores
        </NavLink>
        <NavLink to="/configuracoes/parametros" role="tab">
          Parâmetros
        </NavLink>
      </div>
      <Outlet />
    </div>
  )
}
