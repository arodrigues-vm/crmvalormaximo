import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem do documento de consultor; o Administrador pode alterá-la (D-43). */
export const ECRA_DOCUMENTO: DefinicaoEcra = {
  modulo: 'documentos_consultor',
  nome: 'Documentos de consultores',
  padrao: [
    {
      chave: 'documento',
      titulo: 'Documento',
      campos: ['comissao', 'consultor', 'prestacao', 'tipo', 'documento_original', 'serie', 'numero', 'data_emissao'],
    },
    { chave: 'valores', titulo: 'Valores', campos: ['base', 'taxa_iva', 'iva', 'retencao', 'total', 'saldo'] },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    comissao: 'Comissão',
    consultor: 'Consultor',
    prestacao: 'Prestação',
    tipo: 'Tipo de documento',
    documento_original: 'Documento retificado (nota de crédito)',
    serie: 'Série',
    numero: 'Número',
    data_emissao: 'Data de emissão',
    base: 'Base (sem IVA)',
    taxa_iva: 'Taxa de IVA',
    iva: 'IVA',
    retencao: 'Retenção na fonte',
    total: 'Total (só na consulta)',
    saldo: 'A pagar, pago e em falta (só na consulta)',
    observacoes: 'Observações',
  },
}
