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
import { Disposicoes } from '../modulos/configuracoes/Disposicoes'
import { ListasValores } from '../modulos/configuracoes/ListasValores'
import { ModelosTarefa } from '../modulos/configuracoes/ModelosTarefa'
import { Parametros } from '../modulos/configuracoes/Parametros'
import { TarefaConsulta } from '../modulos/tarefas/TarefaConsulta'
import { TarefaEditar, TarefaNova } from '../modulos/tarefas/TarefaFormulario'
import { TarefasLista } from '../modulos/tarefas/TarefasLista'
import { ImoveisLista } from '../modulos/imoveis/ImoveisLista'
import { ImovelConsulta } from '../modulos/imoveis/ImovelConsulta'
import { ImovelEditar, ImovelNovo } from '../modulos/imoveis/ImovelFormulario'
import { OportunidadeConsulta } from '../modulos/oportunidades/OportunidadeConsulta'
import { OportunidadeEditar, OportunidadeNova } from '../modulos/oportunidades/OportunidadeFormulario'
import { OportunidadesLista } from '../modulos/oportunidades/OportunidadesLista'
import { EquipasLista, MembroConsulta, MembroEditar, MembroNovo, MembrosLista } from '../modulos/equipa/Equipa'
import { PropostaConsulta } from '../modulos/propostas/PropostaConsulta'
import { PropostaEditar, PropostaNova } from '../modulos/propostas/PropostaFormulario'
import { PropostasLista } from '../modulos/propostas/PropostasLista'
import { ComissaoConsulta } from '../modulos/comissoes/ComissaoConsulta'
import { ComissaoEditar } from '../modulos/comissoes/ComissaoFormulario'
import { ComissoesLista } from '../modulos/comissoes/ComissoesLista'
import { DocumentoConsulta } from '../modulos/faturacao/DocumentoConsulta'
import { DocumentoEditar, DocumentoNovo } from '../modulos/faturacao/DocumentoFormulario'
import { DocumentosLista } from '../modulos/faturacao/DocumentosLista'
import { TransacaoConsulta } from '../modulos/transacoes/TransacaoConsulta'
import { TransacaoEditar, TransacaoNova } from '../modulos/transacoes/TransacaoFormulario'
import { TransacoesLista } from '../modulos/transacoes/TransacoesLista'
import {
  AgenciaConsulta,
  AgenciaEditar,
  AgenciaNovo,
  AgenciasLista,
  AgenteConsulta,
  AgenteEditar,
  AgenteNovo,
  AgentesLista,
} from '../modulos/agentes/Paginas'
import { InteresseConsulta } from '../modulos/visitas/InteresseConsulta'
import { InteresseEditar, InteresseNovo } from '../modulos/visitas/InteresseFormulario'
import { InteressesLista } from '../modulos/visitas/InteressesLista'
import { VisitaConsulta } from '../modulos/visitas/VisitaConsulta'
import { VisitaEditar, VisitaNova } from '../modulos/visitas/VisitaFormulario'
import { VisitasLista } from '../modulos/visitas/VisitasLista'
import { ProcuraConsulta } from '../modulos/procuras/ProcuraConsulta'
import { ProcuraEditar, ProcuraNova } from '../modulos/procuras/ProcuraFormulario'
import { ProcurasLista } from '../modulos/procuras/ProcurasLista'
import { ConfigurarMfa } from '../paginas/ConfigurarMfa'
import { Conta } from '../paginas/Conta'
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
        path: 'agentes',
        element: <ExigeModulo modulo="agentes" />,
        children: [
          { index: true, element: <AgentesLista /> },
          { path: 'novo', element: <AgenteNovo /> },
          { path: ':id', element: <AgenteConsulta /> },
          { path: ':id/editar', element: <AgenteEditar /> },
        ],
      },
      {
        path: 'agencias',
        element: <ExigeModulo modulo="agencias" />,
        children: [
          { index: true, element: <AgenciasLista /> },
          { path: 'novo', element: <AgenciaNovo /> },
          { path: ':id', element: <AgenciaConsulta /> },
          { path: ':id/editar', element: <AgenciaEditar /> },
        ],
      },
      {
        path: 'propostas',
        element: <ExigeModulo modulo="propostas" />,
        children: [
          { index: true, element: <PropostasLista /> },
          { path: 'nova', element: <PropostaNova /> },
          { path: ':id', element: <PropostaConsulta /> },
          { path: ':id/editar', element: <PropostaEditar /> },
        ],
      },
      {
        path: 'transacoes',
        element: <ExigeModulo modulo="transacoes" />,
        children: [
          { index: true, element: <TransacoesLista /> },
          { path: 'nova', element: <TransacaoNova /> },
          { path: ':id', element: <TransacaoConsulta /> },
          { path: ':id/editar', element: <TransacaoEditar /> },
        ],
      },
      {
        path: 'pos-venda',
        element: <ExigeModulo modulo="pos-venda" />,
        children: [
          { index: true, element: <TarefasLista /> },
          { path: 'nova', element: <TarefaNova /> },
          { path: ':id', element: <TarefaConsulta /> },
          { path: ':id/editar', element: <TarefaEditar /> },
        ],
      },
      {
        path: 'faturacao',
        element: <ExigeModulo modulo="faturacao" />,
        children: [
          { index: true, element: <ComissoesLista /> },
          { path: 'comissoes/:id', element: <ComissaoConsulta /> },
          { path: 'comissoes/:id/editar', element: <ComissaoEditar /> },
          { path: 'documentos', element: <DocumentosLista /> },
          { path: 'documentos/novo', element: <DocumentoNovo /> },
          { path: 'documentos/:id', element: <DocumentoConsulta /> },
          { path: 'documentos/:id/editar', element: <DocumentoEditar /> },
        ],
      },
      { path: 'conta', element: <Conta /> },
      {
        path: 'equipa',
        element: <ExigeModulo modulo="equipa" />,
        children: [
          { index: true, element: <MembrosLista /> },
          { path: 'equipas', element: <EquipasLista /> },
          { path: 'novo', element: <MembroNovo /> },
          { path: ':id', element: <MembroConsulta /> },
          { path: ':id/editar', element: <MembroEditar /> },
        ],
      },
      {
        path: 'visitas',
        element: <ExigeModulo modulo="visitas" />,
        children: [
          { index: true, element: <VisitasLista /> },
          { path: 'nova', element: <VisitaNova /> },
          { path: 'interesses', element: <InteressesLista /> },
          { path: 'interesses/novo', element: <InteresseNovo /> },
          { path: 'interesses/:id', element: <InteresseConsulta /> },
          { path: 'interesses/:id/editar', element: <InteresseEditar /> },
          { path: ':id', element: <VisitaConsulta /> },
          { path: ':id/editar', element: <VisitaEditar /> },
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
              { path: 'disposicao', element: <Disposicoes /> },
              { path: 'modelos-tarefa', element: <ModelosTarefa /> },
            ],
          },
        ],
      },
      { path: '*', element: <p>Página não encontrada.</p> },
    ],
  },
]
