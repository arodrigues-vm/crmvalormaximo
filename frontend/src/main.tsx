import '@fontsource-variable/inter'
import './estilos.css'

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { ErroApi } from './api/cliente'
import { App } from './app/App'
import { CHAVE_SESSAO, ProvedorSessao } from './app/sessao'

// Sessão expirada (401) em qualquer pedido: voltar ao ecrã de entrada.
function aoErro(erro: unknown) {
  if (erro instanceof ErroApi && erro.estado === 401) queryClient.setQueryData(CHAVE_SESSAO, null)
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: aoErro }),
  mutationCache: new MutationCache({ onError: aoErro }),
  defaultOptions: {
    queries: {
      retry: (n, erro) => !(erro instanceof ErroApi && erro.estado < 500) && n < 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProvedorSessao>
          <App />
        </ProvedorSessao>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
