import type { DefinicaoEcra } from '../../componentes/disposicao'
import { QUALIFICACAO_NEGOCIO, QUALIFICACAO_PROPRIETARIO } from './api'

/** Disposição de origem da oportunidade; o Administrador pode alterá-la (D-43). */
export const ECRA_OPORTUNIDADE: DefinicaoEcra = {
  modulo: 'oportunidades',
  nome: 'Oportunidades de Angariação',
  padrao: [
    {
      chave: 'oportunidade',
      titulo: 'Oportunidade',
      campos: ['entidade', 'operacao', 'estado', 'origem', 'preco_pretendido', 'responsavel'],
    },
    {
      chave: 'proprietario',
      titulo: 'Qualificação do proprietário',
      campos: QUALIFICACAO_PROPRIETARIO.map((c) => c.campo),
    },
    {
      chave: 'imovel',
      titulo: 'Imóvel',
      campos: ['imovel', 'tipo_imovel', 'tipologia', 'localidade', 'descricao_imovel', 'url_anuncio'],
    },
    { chave: 'negocio', titulo: 'Negócio', campos: QUALIFICACAO_NEGOCIO.map((c) => c.campo) },
    { chave: 'observacoes', titulo: 'Observações', campos: ['observacoes'] },
  ],
  rotulos: {
    entidade: 'Proprietário',
    operacao: 'Operação pretendida',
    estado: 'Estado',
    origem: 'Origem do contacto',
    preco_pretendido: 'Valor pretendido pelo imóvel',
    responsavel: 'Responsável',
    imovel: 'Imóvel já registado',
    tipo_imovel: 'Tipo de imóvel',
    tipologia: 'Tipologia',
    localidade: 'Localidade',
    descricao_imovel: 'Descrição do imóvel',
    url_anuncio: 'Anúncio (site)',
    observacoes: 'Observações',
    ...Object.fromEntries([...QUALIFICACAO_PROPRIETARIO, ...QUALIFICACAO_NEGOCIO].map((c) => [c.campo, c.rotulo])),
  },
}
