import type { DefinicaoEcra } from '../../componentes/disposicao'
import { CRITERIOS_INFORMATIVOS, PRE_QUALIFICACAO_FINANCEIRA, QUALIFICACAO_COMPRADOR } from './api'

const CRITERIOS: Record<string, string> = {
  crit_tipos: 'Critério: tipo de imóvel',
  crit_tipologias: 'Critério: tipologia',
  crit_localizacao: 'Critério: localização',
  crit_area: 'Critério: área bruta privativa',
  crit_quartos: 'Critério: quartos',
  crit_wcs: 'Critério: casas de banho',
  crit_elevador: 'Critério: elevador',
  crit_estacionamento: 'Critério: estacionamento',
  crit_zonas_exteriores: 'Critério: zonas exteriores',
  crit_condicoes: 'Critério: condição física',
}

/** Disposição de origem da procura; o Administrador pode alterá-la (D-43). */
export const ECRA_PROCURA: DefinicaoEcra = {
  modulo: 'procuras',
  nome: 'Procuras e Qualificação',
  padrao: [
    { chave: 'prospect', titulo: 'Prospect', campos: ['entidade', 'pretende', 'estado', 'urgencia', 'responsavel'] },
    { chave: 'comprador', titulo: 'Qualificação do comprador', campos: QUALIFICACAO_COMPRADOR.map((c) => c.campo) },
    {
      chave: 'financeira',
      titulo: 'Pré-qualificação financeira',
      campos: ['orcamento_max', 'tolerancia_pct', ...PRE_QUALIFICACAO_FINANCEIRA.map((c) => c.campo)],
    },
    {
      chave: 'criterios',
      titulo: 'Critérios do imóvel',
      campos: [
        'explicacao_criterios',
        ...Object.keys(CRITERIOS),
        'nota_informativos',
        ...CRITERIOS_INFORMATIVOS.map((c) => c.campo),
      ],
    },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    entidade: 'Comprador / arrendatário',
    pretende: 'O cliente pretende',
    estado: 'Estado',
    urgencia: 'Urgência',
    responsavel: 'Responsável (só na consulta)',
    orcamento_max: 'Valor de aquisição previsto',
    tolerancia_pct: 'Tolerância e preço máximo aceite',
    explicacao_criterios: 'Texto: Obrigatório / Preferencial (só na edição)',
    nota_informativos: 'Texto: Outras preferências (só na edição)',
    observacoes: 'Observações',
    ...CRITERIOS,
    ...Object.fromEntries(
      [...QUALIFICACAO_COMPRADOR, ...PRE_QUALIFICACAO_FINANCEIRA, ...CRITERIOS_INFORMATIVOS].map((c) => [
        c.campo,
        c.rotulo,
      ]),
    ),
  },
}
