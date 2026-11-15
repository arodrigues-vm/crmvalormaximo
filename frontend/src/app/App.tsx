/* eslint-disable react-refresh/only-export-components -- ficheiro de definição de rotas */
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom'

import type { Operacao } from '../api/cliente'

import { EntidadeEditar, EntidadeNova } from '../modulos/entidades/EntidadeFormulario'
import { EntidadeConsulta } from '../modulos/entidades/EntidadeConsulta'
import { EntidadesLista } from '../modulos/entidades/EntidadesLista'
import { AngariacaoConsulta } from '../modulos/angariacoes/AngariacaoConsulta'
import { AngariacaoEditar, AngariacaoNova } from '../modulos/angariacoes/AngariacaoFormulario'
import { AngariacoesLista } from '../modulos/angariacoes/AngariacoesLista'
import { Configuracoes } from '../modulos/configuracoes/Configuracoes'
import { ListasValores } from '../modulos/configuracoes/ListasValores'
import { Parametros } from '../modulos/configuracoes/Parametros'
import { ImoveisLista } from '../modulos/imoveis/ImoveisLista'
import { ImovelConsulta } from '../modulos/imoveis/ImovelConsulta'
import { ImovelEditar, ImovelNovo } from '../modulos/imoveis/ImovelFormulario'
import { OportunidadeConsulta } from '../modulos/oportunidades/OportunidadeConsulta'
import { OportunidadeEditar, OportunidadeNova } from '../modulos/oportunidades/OportunidadeFormulario'
import { OportunidadesLista } from '../modulos/oportunidades/OportunidadesLista'
import { ProcuraConsulta } from '../modulos/procuras/ProcuraConsulta'
import { ProcuraEditar, ProcuraNova } from '../modulos/procuras/ProcuraFormulario'
import { ProcurasLista } from '../modulos/procuras/ProcurasLista'
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
function ExigeModulo({ modulo, operacao = 'consultar' }: { modulo: string; operacao?: Operacao }) {
  const { pode } = useSessao()
  if (!pode(modulo, operacao)) return <p className="aviso">Não tem acesso a este módulo.</p>
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
      {
        path: 'imoveis',
        element: <ExigeModulo modulo="imoveis" />,
        children: [
          { index: true, element: <ImoveisLista /> },
          { path: 'novo', element: <ImovelNovo /> },
          { path: ':id', element: <ImovelConsulta /> },
          { path: ':id/editar', element: <ImovelEditar /> },
        ],
      },
      {
        path: 'angariacoes',
        element: <ExigeModulo modulo="angariacoes" />,
        children: [
          { index: true, element: <AngariacoesLista /> },
          { path: 'nova', element: <AngariacaoNova /> },
          { path: ':id', element: <AngariacaoConsulta /> },
          { path: ':id/editar', element: <AngariacaoEditar /> },
        ],
      },
      {
        path: 'oportunidades',
        element: <ExigeModulo modulo="oportunidades" />,
        children: [
          { index: true, element: <OportunidadesLista /> },
          { path: 'nova', element: <OportunidadeNova /> },
          { path: ':id', element: <OportunidadeConsulta /> },
          { path: ':id/editar', element: <OportunidadeEditar /> },
        ],
      },
      {
        path: 'procuras',
        element: <ExigeModulo modulo="procuras" />,
        children: [
          { index: true, element: <ProcurasLista /> },
          { path: 'nova', element: <ProcuraNova /> },
          { path: ':id', element: <ProcuraConsulta /> },
          { path: ':id/editar', element: <ProcuraEditar /> },
        ],
      },
      {
        path: 'configuracoes',
        element: <ExigeModulo modulo="configuracoes" operacao="administrar" />,
        children: [
          {
            element: <Configuracoes />,
            children: [
              { index: true, element: <Navigate to="listas" replace /> },
              { path: 'listas', element: <ListasValores /> },
              { path: 'parametros', element: <Parametros /> },
            ],
          },
        ],
      },
      { path: '*', element: <p>Página não encontrada.</p> },
    ],
  },
]
