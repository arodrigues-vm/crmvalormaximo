import type { CampoQualificacao } from '../../componentes/camposQualificacao'
import type { BlocoDisposicao, DefinicaoEcra } from '../../componentes/disposicao'
import {
  CAMPOS_IMOVEL,
  IMOVEL_AREAS,
  IMOVEL_CARACTERIZACAO,
  IMOVEL_COMERCIALIZACAO,
  IMOVEL_DIVISOES,
  IMOVEL_EQUIPAMENTOS,
  IMOVEL_IDENTIFICACAO,
  IMOVEL_MORADA,
  IMOVEL_REGISTAL,
  IMOVEL_TEXTOS,
  IMOVEL_ZONA,
} from './api'

const c = (lista: CampoQualificacao[]) => lista.map((x) => x.campo)

/** Disposição de origem do imóvel (D-35); o Administrador pode alterá-la (D-43). */
const PADRAO: BlocoDisposicao[] = [
  {
    chave: 'comercializacao',
    titulo: 'Comercialização',
    campos: ['operacao', 'estado_comercializacao', 'status', 'responsavel', ...c(IMOVEL_COMERCIALIZACAO)],
  },
  { chave: 'identificacao', titulo: 'Identificação', campos: c(IMOVEL_IDENTIFICACAO) },
  { chave: 'proprietarios', titulo: 'Proprietários', campos: ['proprietarios'] },
  { chave: 'caracterizacao', titulo: 'Caracterização', campos: [...c(IMOVEL_CARACTERIZACAO), 'zonas_exteriores'] },
  { chave: 'divisoes', titulo: 'Divisões', campos: c(IMOVEL_DIVISOES) },
  { chave: 'equipamentos', titulo: 'Equipamentos e conforto', campos: c(IMOVEL_EQUIPAMENTOS) },
  { chave: 'areas', titulo: 'Áreas (m²)', campos: c(IMOVEL_AREAS) },
  { chave: 'registal', titulo: 'Informação registal', campos: c(IMOVEL_REGISTAL) },
  { chave: 'localizacao', titulo: 'Localização', campos: [...c(IMOVEL_MORADA), 'freguesia', ...c(IMOVEL_ZONA)] },
  { chave: 'textos', titulo: 'Descrição e observações', campos: c(IMOVEL_TEXTOS) },
]

/** Separadores secundários: recolhidos quando estão vazios. */
export const IMOVEL_SECUNDARIOS = new Set(['equipamentos', 'registal', 'textos'])

export const ECRA_IMOVEL: DefinicaoEcra = {
  modulo: 'imoveis',
  nome: 'Imóveis',
  padrao: PADRAO,
  rotulos: {
    operacao: 'Operação',
    estado_comercializacao: 'Estado de comercialização',
    status: 'Status',
    responsavel: 'Responsável',
    proprietarios: 'Proprietários',
    zonas_exteriores: 'Zonas exteriores',
    freguesia: 'Distrito, concelho e freguesia',
    ...Object.fromEntries(CAMPOS_IMOVEL.map((x) => [x.campo, x.rotulo])),
  },
}
