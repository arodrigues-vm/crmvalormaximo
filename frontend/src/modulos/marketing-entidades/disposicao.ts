import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da inscrição de uma entidade num plano de marketing (D-43). */
export const ECRA_INSCRICAO: DefinicaoEcra = {
  modulo: 'marketing_entidades',
  nome: 'Marketing de Entidades (inscrições)',
  padrao: [
    {
      chave: 'inscricao',
      titulo: 'Inscrição',
      campos: ['entidade', 'plano', 'fundamento', 'inicio', 'origem', 'estado', 'responsavel', 'progresso'],
    },
  ],
  rotulos: {
    entidade: 'Entidade',
    plano: 'Plano',
    fundamento: 'Fundamento (RGPD)',
    inicio: 'Início',
    origem: 'Como começou',
    estado: 'Estado',
    responsavel: 'Responsável',
    progresso: 'Progresso',
  },
}
