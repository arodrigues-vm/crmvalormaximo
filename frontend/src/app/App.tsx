import { Route, Routes } from 'react-router-dom'

import { Dashboard } from '../paginas/Dashboard'
import { Layout } from './Layout'

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<p>Página não encontrada.</p>} />
      </Routes>
    </Layout>
  )
}
