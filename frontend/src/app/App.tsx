import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { Dashboard } from '../paginas/Dashboard'
import { Entrar } from '../paginas/Entrar'
import { DefinirPassword, PedirRecuperacao } from '../paginas/Recuperar'
import { Layout } from './Layout'
import { useSessao } from './sessao'

function RotaProtegida({ children }: { children: ReactNode }) {
  const { utilizador, aCarregar } = useSessao()
  const local = useLocation()
  if (aCarregar) return <p className="a-carregar">A carregar…</p>
  if (!utilizador) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />
  return <Layout>{children}</Layout>
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/recuperar" element={<PedirRecuperacao />} />
      <Route path="/recuperar/:uid/:token" element={<DefinirPassword />} />
      <Route
        path="/"
        element={
          <RotaProtegida>
            <Dashboard />
          </RotaProtegida>
        }
      />
      <Route
        path="*"
        element={
          <RotaProtegida>
            <p>Página não encontrada.</p>
          </RotaProtegida>
        }
      />
    </Routes>
  )
}
