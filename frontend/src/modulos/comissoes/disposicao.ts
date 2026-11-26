import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da comissão; o Administrador pode alterá-la (D-43). */
export const ECRA_COMISSAO: DefinicaoEcra = {
  modulo: 'comissoes',
  nome: 'Comissões',
  padrao: [
    {
      chave: 'comissao',
      titulo: 'Comissão',
      campos: ['transacao', 'imovel', 'comprador', 'valor_final', 'iva', 'total_com_iva', 'origem', 'responsavel'],
    },
    {
      chave: 'base',
      titulo: 'Base de cálculo (CMI)',
      campos: ['cmi', 'modalidade', 'taxa_ou_valor', 'base_negocio', 'minimo', 'taxa_iva', 'valor_calculado'],
    },
    { chave: 'reparticao', titulo: 'Repartição', campos: ['pct_angariacao', 'lados', 'beneficiarios'] },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    transacao: 'Transação (só na consulta)',
    imovel: 'Imóvel (só na consulta)',
    comprador: 'Comprador (só na consulta)',
    valor_final: 'Comissão total (sem IVA)',
    iva: 'IVA (só na consulta)',
    total_com_iva: 'Total com IVA (só na consulta)',
    origem: 'Origem do valor (só na consulta)',
    responsavel: 'Responsável',
    cmi: 'CMI (só na consulta)',
    modalidade: 'Modalidade (só na consulta)',
    taxa_ou_valor: 'Taxa / valor / n.º de rendas (só na consulta)',
    base_negocio: 'Valor do negócio (só na consulta)',
    minimo: 'Remuneração mínima (só na consulta)',
    taxa_iva: 'Taxa de IVA (só na consulta)',
    valor_calculado: 'Comissão calculada (só na consulta)',
    pct_angariacao: '% do lado da angariação',
    lados: 'Lados que são nossos',
    beneficiarios: 'Consultores e valores',
    observacoes: 'Observações',
  },
}
