import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem do Plano de Marketing de Imóveis; o Administrador pode alterá-la (D-43). */
export const ECRA_PLANO: DefinicaoEcra = {
  modulo: 'marketing_imoveis',
  nome: 'Plano de Marketing de Imóveis',
  padrao: [
    {
      chave: 'plano',
      titulo: 'Plano',
      campos: ['imovel', 'angariacao', 'ciclo', 'data_base', 'responsavel', 'progresso'],
    },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    imovel: 'Imóvel (só na consulta)',
    angariacao: 'CMI (só na consulta)',
    ciclo: 'Ciclo (só na consulta)',
    data_base: 'Data-base (só na consulta)',
    responsavel: 'Responsável',
    progresso: 'Progresso (só na consulta)',
    observacoes: 'Observações',
  },
}
