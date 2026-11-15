// Navegação lateral: os 23 módulos funcionais agrupados por área.
// "disponivel" passa a true à medida que cada fase é implementada.
export interface Modulo {
  chave: string
  nome: string
  caminho: string
  disponivel: boolean
}

export interface GrupoModulos {
  nome: string
  modulos: Modulo[]
}

const m = (chave: string, nome: string, disponivel = false): Modulo => ({
  chave,
  nome,
  caminho: chave === 'dashboard' ? '/' : `/${chave}`,
  disponivel,
})

export const GRUPOS: GrupoModulos[] = [
  { nome: 'Geral', modulos: [m('dashboard', 'Dashboard', true), m('tarefas', 'Tarefas'), m('agenda', 'Agenda')] },
  {
    nome: 'Comercial',
    modulos: [
      m('entidades', 'Entidades', true),
      m('imoveis', 'Imóveis', true),
      m('angariacoes', 'Angariações', true),
      m('oportunidades', 'Oportunidades de Angariação', true),
      m('procuras', 'Procuras e Qualificação', true),
      m('visitas', 'Visitas'),
      m('propostas', 'Propostas'),
      m('transacoes', 'Transações'),
      m('pos-venda', 'Pós-Venda'),
    ],
  },
  {
    nome: 'Marketing e Comunicação',
    modulos: [
      m('marketing-imoveis', 'Plano de Marketing de Imóveis'),
      m('marketing-entidades', 'Marketing de Entidades'),
      m('comunicacao', 'Comunicação'),
    ],
  },
  {
    nome: 'Finanças e Análise',
    modulos: [
      m('faturacao', 'Faturação e Comissões'),
      m('estatisticas', 'Estatísticas'),
      m('documentos', 'Documentos'),
    ],
  },
  {
    nome: 'Organização',
    modulos: [m('equipa', 'Equipa'), m('agentes', 'Agentes'), m('agencias', 'Agências')],
  },
  { nome: 'Sistema', modulos: [m('glossario', 'Glossário'), m('configuracoes', 'Configurações', true)] },
]
