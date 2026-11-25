import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { EditarCampoQ } from '../../componentes/Qualificacao'
import { qualificacaoParaApi, valoresQualificacao } from '../../componentes/camposQualificacao'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { procurarImoveis } from '../imoveis/api'
import { oportunidadesApi, QUALIFICACAO_NEGOCIO, QUALIFICACAO_PROPRIETARIO, type Oportunidade } from './api'
import { ECRA_OPORTUNIDADE } from './disposicao'

interface Valores {
  entidade: OpcaoPesquisa | null
  imovel: OpcaoPesquisa | null
  tipo_imovel: string
  tipologia: string
  localidade: string
  descricao_imovel: string
  operacao: string
  estado: string
  origem: string
  preco_pretendido: string
  url_anuncio: string
  qualificacao: Record<string, string>
  observacoes: string
}

const CAMPOS_Q = [...QUALIFICACAO_PROPRIETARIO, ...QUALIFICACAO_NEGOCIO]

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const idOuNull = (v: string) => (v ? Number(v) : null)

export function OportunidadeNova() {
  const [params] = useSearchParams()
  const entidadeId = params.get('entidade')
  const { data: e, isLoading } = useQuery({
    queryKey: ['entidades', entidadeId],
    queryFn: () => entidadesApi.obter(entidadeId!),
    enabled: !!entidadeId,
  })
  if (entidadeId && isLoading) return <p className="a-carregar">A carregar…</p>
  return <Formulario entidadeInicial={e ? { id: e.id, titulo: e.nome_completo, detalhe: e.referencia } : null} />
}

export function OportunidadeEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['oportunidades', id], queryFn: () => oportunidadesApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Oportunidade não encontrada ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta oportunidade.</p>
  return <Formulario o={data} key={data.versao} />
}

function Formulario({ o, entidadeInicial = null }: { o?: Oportunidade; entidadeInicial?: OpcaoPesquisa | null }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const inicial = useMemo<Valores>(
    () => ({
      entidade: o ? { id: o.entidade, titulo: o.entidade_nome ?? 'Entidade a que não tem acesso' } : entidadeInicial,
      imovel: o?.imovel ? { id: o.imovel, titulo: o.imovel_descricao } : null,
      tipo_imovel: t(o?.tipo_imovel),
      tipologia: t(o?.tipologia),
      localidade: o?.localidade ?? '',
      descricao_imovel: o?.descricao_imovel ?? '',
      operacao: t(o?.operacao),
      estado: t(o?.estado),
      origem: t(o?.origem),
      preco_pretendido: o?.preco_pretendido ? String(Number(o.preco_pretendido)) : '',
      url_anuncio: o?.url_anuncio ?? '',
      qualificacao: valoresQualificacao(CAMPOS_Q, o as unknown as Record<string, unknown>),
      observacoes: o?.observacoes ?? '',
    }),
    [o, entidadeInicial],
  )
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const opcoes = useQuery({
    queryKey: ['oportunidades', 'opcoes'],
    queryFn: oportunidadesApi.opcoes,
    staleTime: 60_000,
  })
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const op = opcoes.data
  const mudar = <K extends keyof Valores>(c: K, valor: Valores[K]) => setV((a) => ({ ...a, [c]: valor }))
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))
  const mudarQ = (c: string, x: string) => setV((a) => ({ ...a, qualificacao: { ...a.qualificacao, [c]: x } }))
  const opcoesQ = op as unknown as Record<string, { id: number; nome: string }[]> | undefined

  const ctxQ = {
    nomesAtuais: o?.nomes,
    todos: CAMPOS_Q,
    valores: v.qualificacao,
    aoMudar: mudarQ,
    opcoes: opcoesQ,
    erros,
  }
  function desenharCampo(c: string): ReactNode {
    const q = CAMPOS_Q.find((x) => x.campo === c)
    if (q) return <EditarCampoQ c={q} ctx={ctxQ} />
    if (v.imovel && ['tipo_imovel', 'tipologia', 'localidade', 'descricao_imovel'].includes(c)) return null
    switch (c) {
      case 'entidade':
        return (
          <SeletorPesquisavel
            rotulo="Proprietário"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={v.entidade}
            aoMudar={(x) => mudar('entidade', x)}
            erro={erros.entidade?.join(' ')}
          />
        )
      case 'operacao':
        return (
          <CampoSelecao
            rotulo="Operação pretendida"
            vazio="—"
            value={v.operacao}
            onChange={(e) => mudar('operacao', e.target.value)}
            opcoes={lista(op?.operacoes)}
            erro={erros.operacao}
          />
        )
      case 'estado':
        return (
          <CampoSelecao
            rotulo="Estado"
            vazio={o ? undefined : 'Por omissão: o primeiro «em curso»'}
            value={v.estado}
            onChange={(e) => mudar('estado', e.target.value)}
            opcoes={lista(op?.estados)}
            erro={erros.estado}
          />
        )
      case 'origem':
        return (
          <CampoSelecao
            rotulo="Origem do contacto"
            vazio="—"
            value={v.origem}
            onChange={(e) => mudar('origem', e.target.value)}
            opcoes={lista(op?.origens)}
          />
        )
      case 'preco_pretendido':
        return (
          <CampoTexto
            rotulo="Valor pretendido pelo imóvel (€)"
            inputMode="decimal"
            value={v.preco_pretendido}
            onChange={(e) => mudar('preco_pretendido', e.target.value)}
            erro={erros.preco_pretendido}
          />
        )
      case 'imovel':
        return (
          <Largo>
            <p className="ajuda">
              Se o imóvel já estiver registado no CRM, escolha-o. Caso contrário, descreva-o: poderá criá-lo mais tarde
              com «Criar imóvel».
            </p>
            <div className="grelha-campos">
              <SeletorPesquisavel
                rotulo="Imóvel já registado"
                chave="imoveis"
                procurar={procurarImoveis}
                valor={v.imovel}
                aoMudar={(x) => mudar('imovel', x)}
                erro={erros.imovel?.join(' ')}
                placeholder="Referência, morada…"
              />
            </div>
          </Largo>
        )
      case 'tipo_imovel':
        return (
          <CampoSelecao
            rotulo="Tipo de imóvel"
            vazio="—"
            value={v.tipo_imovel}
            onChange={(e) => mudar('tipo_imovel', e.target.value)}
            opcoes={lista(op?.tipos_imovel)}
          />
        )
      case 'tipologia':
        return (
          <CampoSelecao
            rotulo="Tipologia"
            vazio="—"
            value={v.tipologia}
            onChange={(e) => mudar('tipologia', e.target.value)}
            opcoes={lista(op?.tipologias)}
          />
        )
      case 'localidade':
        return (
          <CampoTexto rotulo="Localidade" value={v.localidade} onChange={(e) => mudar('localidade', e.target.value)} />
        )
      case 'descricao_imovel':
        return (
          <CampoTexto
            rotulo="Descrição do imóvel"
            largo
            value={v.descricao_imovel}
            onChange={(e) => mudar('descricao_imovel', e.target.value)}
            placeholder="Ex.: moradia junto à escola"
          />
        )
      case 'url_anuncio':
        return (
          <CampoTexto
            rotulo="Anúncio (site)"
            type="url"
            largo
            value={v.url_anuncio}
            onChange={(e) => mudar('url_anuncio', e.target.value)}
            erro={erros.url_anuncio}
            placeholder="https://…"
            ajuda="Endereço do anúncio, se o imóvel já estiver anunciado noutro site."
          />
        )
      case 'observacoes':
        return (
          <CampoAreaTexto
            rotulo="Observações"
            value={v.observacoes}
            onChange={(e) => mudar('observacoes', e.target.value)}
          />
        )
    }
    return null
  }

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo = {
      entidade: v.entidade?.id ?? null,
      imovel: v.imovel?.id ?? null,
      tipo_imovel: idOuNull(v.tipo_imovel),
      tipologia: idOuNull(v.tipologia),
      localidade: v.localidade,
      descricao_imovel: v.descricao_imovel,
      operacao: idOuNull(v.operacao),
      estado: idOuNull(v.estado),
      origem: idOuNull(v.origem),
      preco_pretendido: v.preco_pretendido.trim() ? v.preco_pretendido.replace(/\s/g, '').replace(',', '.') : null,
      url_anuncio: v.url_anuncio.trim(),
      ...qualificacaoParaApi(CAMPOS_Q, v.qualificacao),
      observacoes: v.observacoes,
    }
    try {
      const r = o
        ? await oportunidadesApi.atualizar(o.id, { ...corpo, versao: o.versao })
        : await oportunidadesApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['oportunidades'] })
      qc.setQueryData(['oportunidades', String(r.id)], r)
      navegar(`/oportunidades/${r.id}`, { replace: !o })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Oportunidades"
        caminho="/oportunidades"
        referencia={o?.referencia ?? 'Nova'}
        titulo={o ? 'Editar oportunidade' : 'Nova oportunidade de angariação'}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_OPORTUNIDADE}
        modo="editar"
        campo={desenharCampo}
        erros={erros}
        abertoInicial={(b) => (b.chave === 'negocio' ? !!o : b.chave === 'observacoes' ? !!v.observacoes : true)}
      />

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(o ? `/oportunidades/${o.id}` : '/oportunidades')}
        >
          Cancelar
        </button>
        <button type="submit" className="botao-principal" disabled={aGravar}>
          {aGravar ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
      {guarda.dialogo}
    </form>
  )
}
