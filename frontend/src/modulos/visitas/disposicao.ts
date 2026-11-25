import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Critérios da ficha de visita (iguais aos do servidor, `CRITERIOS_AVALIACAO`). */
export const CRITERIOS_VISITA: Record<string, string> = {
  av_localizacao: 'Localização / zona',
  av_infraestruturas: 'Infraestruturas / serviços',
  av_construcao: 'Qualidade de construção',
  av_acabamentos: 'Acabamentos',
  av_areas: 'Áreas',
  av_planta: 'Planta do imóvel',
  av_vista: 'Vista',
  av_estacionamento: 'Estacionamento',
  av_preco: 'Preço',
}

/** Disposição de origem da visita; o Administrador pode alterá-la (D-43). */
export const ECRA_VISITA: DefinicaoEcra = {
  modulo: 'visitas',
  nome: 'Visitas',
  padrao: [
    {
      chave: 'visita',
      titulo: 'Visita',
      campos: [
        'imovel_registado',
        'imovel',
        'imovel_localizacao',
        'entidade',
        'agente_comprador',
        'agente_imovel',
        'estado',
        'data',
        'hora_entrada',
        'hora_saida',
        'responsavel',
        'acompanhantes',
      ],
    },
    {
      chave: 'avaliacao',
      titulo: 'Avaliação do cliente',
      campos: ['ajuda_avaliacao', ...Object.keys(CRITERIOS_VISITA), 'mais_gostou', 'menos_gostou', 'compraria'],
    },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    imovel_registado: 'O imóvel está registado no CRM? (só na edição)',
    imovel: 'Imóvel / descrição do imóvel',
    imovel_localizacao: 'Localização (imóvel não registado)',
    entidade: 'Cliente',
    agente_comprador: 'Agente responsável pelo comprador',
    agente_imovel: 'Agente responsável pelo imóvel',
    estado: 'Estado',
    data: 'Data da visita',
    hora_entrada: 'Hora de entrada',
    hora_saida: 'Hora de saída',
    responsavel: 'Consultor (só na consulta)',
    acompanhantes: 'Acompanhantes',
    ajuda_avaliacao: 'Texto: «Preencha depois da visita» (só na edição)',
    ...CRITERIOS_VISITA,
    mais_gostou: 'O que mais gostou?',
    menos_gostou: 'O que menos gostou?',
    compraria: 'Compraria este imóvel?',
    observacoes: 'Observações',
  },
}

/** Disposição de origem do interesse; o Administrador pode alterá-la (D-43). */
export const ECRA_INTERESSE: DefinicaoEcra = {
  modulo: 'interesses',
  nome: 'Interesses',
  padrao: [
    {
      chave: 'interesse',
      titulo: 'Interesse',
      campos: ['entidade', 'imovel', 'origem', 'grau', 'estado', 'ultima_visita', 'responsavel', 'observacoes'],
    },
  ],
  rotulos: {
    entidade: 'Cliente',
    imovel: 'Imóvel',
    origem: 'Origem',
    grau: 'Grau de interesse',
    estado: 'Estado',
    ultima_visita: 'Última visita (só na consulta)',
    responsavel: 'Responsável (só na consulta)',
    observacoes: 'Observações',
  },
}
