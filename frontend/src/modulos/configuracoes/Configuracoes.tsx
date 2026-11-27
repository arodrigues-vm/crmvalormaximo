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
        <NavLink to="/configuracoes/disposicao" role="tab">
          Disposição dos ecrãs
        </NavLink>
        <NavLink to="/configuracoes/modelos-tarefa" role="tab">
          Modelos de tarefas
        </NavLink>
        <NavLink to="/configuracoes/marketing-entidades" role="tab">
          Marketing de Entidades
        </NavLink>
      </div>
      <Outlet />
    </div>
  )
}
