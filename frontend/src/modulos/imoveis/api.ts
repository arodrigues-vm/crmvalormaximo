import { pedido } from '../../api/cliente'
import type { CampoQualificacao } from '../../componentes/camposQualificacao'
import type { EntradaHistorico } from '../../componentes/Ficha'

type Opcao = { id: number; nome: string; categoria?: string }

export interface ProprietarioDetalhe {
  entidade: number
  acessivel: boolean
  nome_completo: string | null
  referencia: string | null
  quota: string | null
}

export interface Imovel {
  id: number
  referencia: string
  tipo: number | null
  tipologia: number | null
  operacao: number | null
  estado_comercializacao: number | null
  status: number | null
  tem_fotografia: boolean
  condicao_fisica: number | null
  preco: string | null
  duplicado_de: number | null
  duplicado_de_referencia: string | null
  rua: string
  numero_policia: string
  complemento: string
  codigo_postal: string
  localidade: string
  freguesia: number | null
  localizacao: { freguesia: string; concelho: string; distrito: string } | null
  zona_comercial: number | null
  localizacao_descritiva: string
  area_bruta_privativa: string | null
  area_bruta_dependente: string | null
  area_util: string | null
  area_terreno: string | null
  quartos: number | null
  casas_banho: number | null
  ano_construcao: number | null
  piso: string
  elevador: boolean | null
  lugares_estacionamento: number | null
  certificado_energetico: number | null
  zonas_exteriores: number[]
  descricao: string
  proprietarios_detalhe: ProprietarioDetalhe[]
  responsavel: number
  responsavel_nome: string
  observacoes: string
  nomes: {
    tipo: string | null
    tipologia: string | null
    estado_comercializacao: string | null
    condicao_fisica: string | null
    zona_comercial: string | null
    certificado_energetico: string | null
    zonas_exteriores: string[]
    operacao: string | null
    operacao_categoria: string | null
    status: string | null
    status_categoria: string | null
    [campo: string]: unknown
  }
  criado_em: string
  atualizado_em: string
  versao: number
  acoes: { editar: boolean; eliminar: boolean; transferir: boolean }
}

export interface ImovelResumo {
  id: number
  referencia: string
  tipo_nome: string | null
  tipologia_nome: string | null
  operacao_nome: string | null
  estado_comercializacao_nome: string | null
  status_nome: string | null
  status_categoria: string | null
  tem_fotografia: boolean
  versao: number
  preco: string | null
  localidade: string
  concelho: string | null
  area_bruta_privativa: string | null
  proprietarios_nomes: string[]
  responsavel_nome: string
}

export interface OpcoesImovel {
  tipos: Opcao[]
  tipologias: Opcao[]
  estados_comercializacao: Opcao[]
  condicoes_fisicas: Opcao[]
  zonas_comerciais: Opcao[]
  certificados_energeticos: Opcao[]
  zonas_exteriores: Opcao[]
  operacoes: Opcao[]
  status: Opcao[]
  pode_criar: boolean
  pode_transferir: boolean
  pode_restaurar: boolean
}

export interface ImovelDaEntidade {
  id: number
  referencia: string
  tipo: string | null
  tipologia: string | null
  localidade: string
  estado_comercializacao: string | null
  status: string | null
  status_categoria: string | null
  quota: string | null
}

const BASE = '/api/imoveis/'

export const imoveisApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: ImovelResumo[] }>(`${BASE}?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Imovel>(`${BASE}${id}/`),
  criar: (dados: unknown) => pedido<Imovel>(BASE, { json: dados }),
  atualizar: (id: number, dados: unknown) => pedido<Imovel>(`${BASE}${id}/`, { method: 'PATCH', json: dados }),
  duplicar: (id: number) =>
    pedido<{ id: number; referencia: string }>(`${BASE}${id}/duplicar/`, { json: { confirmar: true } }),
  eliminar: (id: number) => pedido<null>(`${BASE}${id}/`, { method: 'DELETE' }),
  opcoes: () => pedido<OpcoesImovel>(`${BASE}opcoes/`),
  historico: (id: number) => pedido<EntradaHistorico[]>(`${BASE}${id}/historico/`),
  carregarFotografia: (id: number, ficheiro: File) => {
    const dados = new FormData()
    dados.append('ficheiro', ficheiro)
    return pedido<Imovel>(`${BASE}${id}/fotografia/`, { method: 'POST', body: dados })
  },
  removerFotografia: (id: number) => pedido<Imovel>(`${BASE}${id}/fotografia/`, { method: 'DELETE' }),
  daEntidade: (entidade: number) =>
    pedido<{ imoveis: ImovelDaEntidade[]; outros: number }>(`/api/entidades/${entidade}/imoveis/`),
}

const STATUS_ETIQUETA: Record<string, 'sucesso' | 'neutra' | 'aviso'> = {
  ativo: 'sucesso',
  inativo: 'aviso',
  arquivado: 'neutra',
}
export const etiquetaStatus = (categoria: string | null | undefined) => STATUS_ETIQUETA[categoria ?? ''] ?? 'neutra'

/** Endereço da fotografia (privada; o servidor verifica a sessão). `versao` evita imagens antigas em cache. */
export const urlFotografia = (id: number, versao: number, miniatura = false) =>
  `/api/imoveis/${id}/fotografia/?${miniatura ? 'tamanho=miniatura&' : ''}v=${versao}`

export function tituloImovel(i: { tipo?: string | null; tipologia?: string | null; localidade?: string }) {
  return [[i.tipo, i.tipologia].filter(Boolean).join(' '), i.localidade].filter(Boolean).join(' · ') || 'Imóvel'
}

export const NOMES_CAMPOS_IMOVEL: Record<string, string> = {
  tipo: 'Tipo',
  tipologia: 'Tipologia',
  operacao: 'Operação',
  estado_comercializacao: 'Estado de comercialização',
  status: 'Status',
  condicao_fisica: 'Condição física',
  preco: 'Valor',
  rua: 'Rua',
  numero_policia: 'N.º de polícia',
  complemento: 'Complemento',
  codigo_postal: 'Código postal',
  localidade: 'Localidade',
  freguesia: 'Freguesia',
  zona_comercial: 'Zona comercial',
  localizacao_descritiva: 'Localização descritiva',
  area_bruta_privativa: 'Área bruta privativa',
  area_bruta_dependente: 'Área bruta dependente',
  area_util: 'Área útil',
  area_terreno: 'Área do terreno',
  quartos: 'Quartos',
  casas_banho: 'Casas de banho',
  ano_construcao: 'Ano de construção',
  piso: 'Piso',
  elevador: 'Elevador',
  lugares_estacionamento: 'Lugares de estacionamento',
  certificado_energetico: 'Certificado energético',
  descricao: 'Descrição',
  responsavel: 'Responsável',
  observacoes: 'Observações',
  eliminado_em: 'Eliminado em',
}

/** Para seletores pesquisáveis de imóveis. */
export const procurarImoveis = async (termo: string) =>
  (await imoveisApi.listar({ pesquisa: termo })).results.map((i) => ({
    id: i.id,
    titulo: i.referencia,
    detalhe: [[i.tipo_nome, i.tipologia_nome].filter(Boolean).join(' '), i.localidade].filter(Boolean).join(' · '),
  }))

/*
 * Campos do imóvel por separador, pela ordem pedida pelo proprietário (D-35, 19/11/2026).
 * Operação, estado de comercialização, status, proprietários, zonas exteriores e a localização
 * administrativa (CAOP) têm componentes próprios no formulário.
 */
export const IMOVEL_COMERCIALIZACAO: CampoQualificacao[] = [
  { campo: 'preco', rotulo: 'Valor', tipo: 'euros', ajuda: 'Deixe vazio se ainda não for conhecido.' },
  { campo: 'link_site', rotulo: 'Link do site', tipo: 'url', ajuda: 'Anúncio do imóvel no site.' },
]

export const IMOVEL_IDENTIFICACAO: CampoQualificacao[] = [
  { campo: 'tipo', rotulo: 'Tipo de imóvel', tipo: 'lista', lista: 'tipos' },
  { campo: 'tipologia', rotulo: 'Tipologia', tipo: 'lista', lista: 'tipologias' },
  { campo: 'condicao_fisica', rotulo: 'Estado do imóvel', tipo: 'lista', lista: 'condicoes_fisicas' },
  { campo: 'destino_imovel', rotulo: 'Destino do imóvel', tipo: 'lista', lista: 'destinos_imovel' },
  { campo: 'ocupacao', rotulo: 'Ocupação', tipo: 'lista', lista: 'ocupacoes_imovel' },
  { campo: 'habitavel', rotulo: 'Habitável', tipo: 'lista', lista: 'sim_nao' },
]

export const IMOVEL_CARACTERIZACAO: CampoQualificacao[] = [
  { campo: 'situacao', rotulo: 'Situação do imóvel', tipo: 'lista', lista: 'situacoes_imovel' },
  { campo: 'ano_construcao', rotulo: 'Ano de construção', tipo: 'numero' },
  { campo: 'conservacao', rotulo: 'Conservação', tipo: 'lista', lista: 'conservacoes' },
  { campo: 'acabamentos', rotulo: 'Acabamentos', tipo: 'lista', lista: 'acabamentos' },
  { campo: 'piso', rotulo: 'Piso', tipo: 'texto' },
  { campo: 'elevadores', rotulo: 'Elevadores', tipo: 'lista', lista: 'quantidades' },
  { campo: 'garagem', rotulo: 'Garagem', tipo: 'lista', lista: 'garagens' },
  { campo: 'piscina', rotulo: 'Piscina', tipo: 'lista', lista: 'piscinas' },
]

export const IMOVEL_DIVISOES: CampoQualificacao[] = [
  { campo: 'quartos', rotulo: 'Quartos', tipo: 'numero' },
  { campo: 'suites', rotulo: 'Suites', tipo: 'numero' },
  { campo: 'quartos_extra', rotulo: 'Quartos +1', tipo: 'numero' },
  { campo: 'salas', rotulo: 'Salas', tipo: 'numero' },
  { campo: 'casas_banho', rotulo: 'WCs', tipo: 'numero' },
  { campo: 'wcs_servico', rotulo: 'WCs de serviço', tipo: 'numero' },
  { campo: 'cozinha', rotulo: 'Cozinha', tipo: 'lista', lista: 'cozinhas' },
  { campo: 'marquises', rotulo: 'Marquise', tipo: 'numero' },
  { campo: 'lavandarias', rotulo: 'Lavandaria', tipo: 'numero' },
  { campo: 'arrumacao', rotulo: 'Arrumação', tipo: 'lista', lista: 'classificacoes' },
  { campo: 'outras_divisoes', rotulo: 'Outras', tipo: 'texto', ajuda: 'Ex.: escritório, sótão.' },
]

export const IMOVEL_EQUIPAMENTOS: CampoQualificacao[] = [
  { campo: 'certificado_energetico', rotulo: 'Classe energética', tipo: 'lista', lista: 'certificados_energeticos' },
  { campo: 'certificado_numero', rotulo: 'N.º do certificado energético', tipo: 'texto' },
  { campo: 'climatizacao', rotulo: 'Climatização', tipo: 'lista', lista: 'climatizacoes' },
  { campo: 'caixilharia', rotulo: 'Caixilharias', tipo: 'lista', lista: 'caixilharias' },
]

export const IMOVEL_AREAS: CampoQualificacao[] = [
  { campo: 'area_bruta_privativa', rotulo: 'Área bruta privativa', tipo: 'm2' },
  { campo: 'area_bruta_dependente', rotulo: 'Área bruta dependente', tipo: 'm2' },
  { campo: 'area_util', rotulo: 'Área útil', tipo: 'm2' },
  { campo: 'area_terreno', rotulo: 'Área do lote', tipo: 'm2' },
  { campo: 'area_coberta', rotulo: 'Área coberta', tipo: 'm2' },
  { campo: 'area_descoberta', rotulo: 'Área descoberta', tipo: 'm2' },
  { campo: 'area_construcao', rotulo: 'Área de construção', tipo: 'm2' },
  { campo: 'fonte_areas', rotulo: 'Fonte das áreas', tipo: 'lista', lista: 'fontes_areas' },
  { campo: 'conformidade_areas', rotulo: 'Conformidade de áreas', tipo: 'longo' },
]

export const IMOVEL_REGISTAL: CampoQualificacao[] = [
  { campo: 'artigo_matricial', rotulo: 'Artigo matricial', tipo: 'texto' },
  { campo: 'tipo_artigo', rotulo: 'Tipo de artigo', tipo: 'lista', lista: 'artigos_matriciais' },
  { campo: 'descricao_registo_predial', rotulo: 'Descrição do registo predial', tipo: 'texto' },
  { campo: 'licenca_habitabilidade', rotulo: 'Licença de habitabilidade', tipo: 'texto' },
  { campo: 'licenca_construcao', rotulo: 'Licença de construção', tipo: 'texto' },
  { campo: 'alvara_loteamento', rotulo: 'Alvará de loteamento', tipo: 'texto' },
]

/** Localização: antes do seletor Distrito/Concelho/Freguesia. */
export const IMOVEL_MORADA: CampoQualificacao[] = [
  { campo: 'link_localizacao', rotulo: 'Link da localização', tipo: 'url', ajuda: 'Ex.: endereço do Google Maps.' },
  { campo: 'rua', rotulo: 'Rua', tipo: 'texto' },
  { campo: 'numero_policia', rotulo: 'N.º de polícia', tipo: 'texto' },
  { campo: 'complemento', rotulo: 'Complemento', tipo: 'texto', ajuda: 'Andar, fração, lote…' },
  { campo: 'codigo_postal', rotulo: 'Código postal', tipo: 'texto' },
  { campo: 'localidade', rotulo: 'Localidade', tipo: 'texto' },
]

/** Localização: depois do seletor Distrito/Concelho/Freguesia. */
export const IMOVEL_ZONA: CampoQualificacao[] = [
  { campo: 'zona_comercial', rotulo: 'Zona comercial', tipo: 'lista', lista: 'zonas_comerciais' },
  {
    campo: 'localizacao_descritiva',
    rotulo: 'Localização descritiva',
    tipo: 'texto',
    ajuda: 'Ex.: junto ao parque da cidade.',
  },
]

export const IMOVEL_TEXTOS: CampoQualificacao[] = [
  { campo: 'descricao', rotulo: 'Descrição', tipo: 'longo' },
  { campo: 'observacoes', rotulo: 'Observações (internas)', tipo: 'longo' },
]

export const CAMPOS_IMOVEL = [
  ...IMOVEL_COMERCIALIZACAO,
  ...IMOVEL_IDENTIFICACAO,
  ...IMOVEL_CARACTERIZACAO,
  ...IMOVEL_DIVISOES,
  ...IMOVEL_EQUIPAMENTOS,
  ...IMOVEL_AREAS,
  ...IMOVEL_REGISTAL,
  ...IMOVEL_MORADA,
  ...IMOVEL_ZONA,
  ...IMOVEL_TEXTOS,
]

for (const c of CAMPOS_IMOVEL) NOMES_CAMPOS_IMOVEL[c.campo] = c.rotulo
