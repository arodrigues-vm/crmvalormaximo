// Navegação lateral: os 23 módulos funcionais agrupados por área.
// "disponivel" passa a true à medida que cada fase é implementada.
export interface Modulo {
  chave: string
  nome: string
  caminho: string
  disponivel: boolean
  /** Módulo de permissões, quando é diferente da chave (ex.: Seguimento Compradores usa as de Visitas). */
  permissao?: string
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
  {
    nome: 'Geral',
    modulos: [m('dashboard', 'Dashboard', true), m('tarefas', 'Tarefas', true), m('agenda', 'Agenda', true)],
  },
  {
    nome: 'Comercial',
    modulos: [
      m('entidades', 'Entidades', true),
      m('imoveis', 'Imóveis', true),
      m('angariacoes', 'Angariações', true),
      m('oportunidades', 'Oportunidades de Angariação', true),
      m('procuras', 'Procuras e Qualificação', true),
      m('visitas', 'Visitas', true),
      // Interesses dos compradores (D-36), com nome escolhido pelo proprietário (D-45).
      {
        chave: 'seguimento',
        nome: 'Seguimento Compradores',
        caminho: '/visitas/interesses',
        disponivel: true,
        permissao: 'visitas',
      },
      m('propostas', 'Propostas', true),
      m('transacoes', 'Transações', true),
      m('pos-venda', 'Pós-Venda', true),
    ],
  },
  {
    nome: 'Marketing e Comunicação',
    modulos: [
      m('marketing-imoveis', 'Plano de Marketing de Imóveis', true),
      m('marketing-entidades', 'Marketing de Entidades'),
      m('comunicacao', 'Comunicação'),
    ],
  },
  {
    nome: 'Finanças e Análise',
    modulos: [
      m('faturacao', 'Faturação e Comissões', true),
      m('estatisticas', 'Estatísticas'),
      m('documentos', 'Documentos'),
    ],
  },
  {
    nome: 'Organização',
    modulos: [m('equipa', 'Equipa', true), m('agentes', 'Agentes', true), m('agencias', 'Agências', true)],
  },
  { nome: 'Sistema', modulos: [m('glossario', 'Glossário'), m('configuracoes', 'Configurações', true)] },
]
