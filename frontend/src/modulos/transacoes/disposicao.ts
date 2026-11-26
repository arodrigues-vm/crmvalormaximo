import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da transação; o Administrador pode alterá-la (D-43). */
export const ECRA_TRANSACAO: DefinicaoEcra = {
  modulo: 'transacoes',
  nome: 'Transações',
  padrao: [
    {
      chave: 'negocio',
      titulo: 'Negócio',
      campos: [
        'proposta',
        'imovel',
        'entidade',
        'operacao',
        'angariacao',
        'valor',
        'sinal',
        'estado',
        'responsavel_imovel',
        'responsavel_comprador',
        'responsavel',
      ],
    },
    {
      chave: 'datas',
      titulo: 'CPCV e escritura',
      campos: ['data_cpcv_prevista', 'data_cpcv', 'data_escritura_prevista', 'data_escritura'],
    },
    { chave: 'participantes', titulo: 'Participantes', campos: ['participantes'] },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    proposta: 'Proposta de origem (só na consulta)',
    imovel: 'Imóvel (só na consulta)',
    entidade: 'Comprador (só na consulta)',
    operacao: 'Operação',
    angariacao: 'CMI',
    valor: 'Valor acordado',
    sinal: 'Sinal',
    estado: 'Estado (só na consulta)',
    responsavel_imovel: 'Responsável pelo imóvel (só na consulta)',
    responsavel_comprador: 'Responsável pela entidade (só na consulta)',
    responsavel: 'Responsável',
    data_cpcv_prevista: 'Data prevista do CPCV',
    data_cpcv: 'Data do CPCV',
    data_escritura_prevista: 'Data prevista da escritura / contrato',
    data_escritura: 'Data da escritura / contrato',
    participantes: 'Participantes',
    observacoes: 'Observações',
  },
}
