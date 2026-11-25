import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da proposta; o Administrador pode alterá-la (D-43). */
export const ECRA_PROPOSTA: DefinicaoEcra = {
  modulo: 'propostas',
  nome: 'Propostas',
  padrao: [
    {
      chave: 'proposta',
      titulo: 'Proposta',
      campos: [
        'valor_atual',
        'imovel_registado',
        'imovel',
        'imovel_localizacao',
        'entidade',
        'agente_comprador',
        'agente_imovel',
        'estado',
        'visita',
        'responsavel',
      ],
    },
    { chave: 'participantes', titulo: 'Participantes', campos: ['participantes'] },
    { chave: 'ronda', titulo: 'Valor e condições', campos: ['ronda_inicial'] },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    valor_atual: 'Valor atual (só na consulta)',
    estado: 'Estado',
    imovel_registado: 'O imóvel está registado no CRM? (só na edição)',
    imovel: 'Imóvel / descrição do imóvel',
    imovel_localizacao: 'Localização (imóvel não registado, só na edição)',
    entidade: 'Comprador',
    agente_comprador: 'Responsável pela entidade',
    agente_imovel: 'Responsável pelo imóvel',
    visita: 'Visita de origem (só na consulta)',
    responsavel: 'Responsável (só na consulta)',
    participantes: 'Participantes',
    ronda_inicial: 'Valor e condições da 1.ª ronda (só ao criar)',
    observacoes: 'Observações',
  },
}
