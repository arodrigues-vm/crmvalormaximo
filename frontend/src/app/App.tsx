/* eslint-disable react-refresh/only-export-components -- ficheiro de definição de rotas */
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom'

import { EntidadeEditar, EntidadeNova } from '../modulos/entidades/EntidadeFormulario'
import { EntidadeConsulta } from '../modulos/entidades/EntidadeConsulta'
import { EntidadesLista } from '../modulos/entidades/EntidadesLista'
import { ConfigurarMfa } from '../paginas/ConfigurarMfa'
import { Dashboard } from '../paginas/Dashboard'
import { Entrar } from '../paginas/Entrar'
import { DefinirPassword, PedirRecuperacao } from '../paginas/Recuperar'
import { Layout } from './Layout'
import { useSessao } from './sessao'

function AreaProtegida() {
  const { utilizador, aCarregar } = useSessao()
  const local = useLocation()
  if (aCarregar) return <p className="a-carregar">A carregar…</p>
  if (!utilizador) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />
  if (utilizador.mfa_configuracao_pendente) return <ConfigurarMfa />
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

/** Exige permissão de consulta no módulo (a API volta a verificar sempre). */
function ExigeModulo({ modulo }: { modulo: string }) {
  const { pode } = useSessao()
  if (!pode(modulo)) return <p className="aviso">Não tem acesso a este módulo.</p>
  return <Outlet />
}

export const rotas: RouteObject[] = [
  { path: '/entrar', element: <Entrar /> },
  { path: '/recuperar', element: <PedirRecuperacao /> },
  { path: '/recuperar/:uid/:token', element: <DefinirPassword /> },
  {
    element: <AreaProtegida />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: 'entidades',
        element: <ExigeModulo modulo="entidades" />,
        children: [
          { index: true, element: <EntidadesLista /> },
          { path: 'nova', element: <EntidadeNova /> },
          { path: ':id', element: <EntidadeConsulta /> },
          { path: ':id/editar', element: <EntidadeEditar /> },
        ],
      },
      { path: '*', element: <p>Página não encontrada.</p> },
    ],
  },
]
