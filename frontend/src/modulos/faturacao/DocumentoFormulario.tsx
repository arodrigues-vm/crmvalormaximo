import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { formatarEuros } from '../../componentes/formatar'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { comissoesApi } from '../comissoes/api'
import { documentosApi, type Documento } from './api'
import { ECRA_DOCUMENTO } from './disposicao'

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const n = (v: string | null) => (v === null ? '' : String(Number(v)))
const dec = (v: string) => (v.trim() ? v.trim().replace(/\s/g, '').replace(',', '.') : null)

export function DocumentoNovo() {
  const [p] = useSearchParams()
  const comissao = p.get('comissao')
  if (!comissao)
    return <p className="aviso">Os documentos registam-se a partir da comissão (Pagamentos aos consultores).</p>
  return (
    <Formulario
      comissaoId={Number(comissao)}
      inicial={{
        consultor: p.get('consultor') ?? '',
        prestacao: p.get('prestacao') ?? '',
        tipo: '',
        documento_original: '',
        serie: '',
        numero: '',
        data_emissao: '',
        base: p.get('valor') ?? '',
        taxa_iva: '',
        iva: '',
        retencao: '',
        observacoes: '',
      }}
    />
  )
}

export function DocumentoEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['documentos-consultor', id],
    queryFn: () => documentosApi.obter(id),
  })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Documento não encontrado ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar este documento.</p>
  return (
    <Formulario
      key={data.versao}
      documento={data}
      comissaoId={data.comissao}
      inicial={{
        consultor: String(data.consultor),
        prestacao: t(data.prestacao),
        tipo: String(data.tipo),
        documento_original: t(data.documento_original),
        serie: data.serie,
        numero: data.numero,
        data_emissao: data.data_emissao,
        base: n(data.base),
        taxa_iva: n(data.taxa_iva),
        iva: n(data.iva),
        retencao: n(data.retencao),
        observacoes: data.observacoes,
      }}
    />
  )
}

type Valores = Record<
  | 'consultor'
  | 'prestacao'
  | 'tipo'
  | 'documento_original'
  | 'serie'
  | 'numero'
  | 'data_emissao'
  | 'base'
  | 'taxa_iva'
  | 'iva'
  | 'retencao'
  | 'observacoes',
  string
>

function Formulario({
  documento,
  comissaoId,
  inicial,
}: {
  documento?: Documento
  comissaoId: number
  inicial: Valores
}) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const base0 = useMemo(() => inicial, [inicial])
  const [v, setV] = useState(base0)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const cp = usePersonalizados(ECRA_DOCUMENTO, comoRegistoCp(documento))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(base0) || cp.alterado)
  const opcoes = useQuery({
    queryKey: ['documentos-consultor', 'opcoes'],
    queryFn: documentosApi.opcoes,
    staleTime: 60_000,
  })
  const comissao = useQuery({
    queryKey: ['comissoes', String(comissaoId)],
    queryFn: () => comissoesApi.obter(comissaoId),
  })
  const outros = useQuery({
    queryKey: ['documentos-consultor', 'lista', { comissao: comissaoId, consultor: v.consultor }],
    queryFn: () => documentosApi.listar({ comissao: String(comissaoId), consultor: v.consultor }),
    enabled: !!v.consultor,
  })
  const mudar = (k: keyof Valores, x: string) => setV((a) => ({ ...a, [k]: x }))
  const c = comissao.data
  const consultores = [
    ...new Map((c?.beneficiarios ?? []).map((b) => [b.utilizador, b.utilizador_nome ?? ''])).entries(),
  ]
  const prestacoes = (c?.prestacoes ?? []).filter((p) => String(p.utilizador) === v.consultor)
  const credito = opcoes.data?.tipos.find((x) => String(x.id) === v.tipo)?.categoria === 'credito'
  const comPagamentos = !!documento?.movimentos.length
  const ivaCalculado = v.base && v.taxa_iva ? (Number(dec(v.base)) * Number(dec(v.taxa_iva))) / 100 : null

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo: Record<string, unknown> = {
      comissao: comissaoId,
      consultor: v.consultor ? Number(v.consultor) : null,
      prestacao: v.prestacao ? Number(v.prestacao) : null,
      tipo: v.tipo ? Number(v.tipo) : null,
      documento_original: credito && v.documento_original ? Number(v.documento_original) : null,
      serie: v.serie.trim(),
      numero: v.numero.trim(),
      data_emissao: v.data_emissao || null,
      base: dec(v.base),
      taxa_iva: dec(v.taxa_iva),
      retencao: dec(v.retencao) ?? '0',
      observacoes: v.observacoes,
      campos_personalizados: cp.paraApi(),
    }
    // IVA vazio = o servidor calcula-o a partir da base e da taxa.
    if (v.iva.trim()) corpo.iva = dec(v.iva)
    if (comPagamentos) {
      for (const k of ['comissao', 'consultor', 'tipo', 'base', 'taxa_iva', 'iva', 'retencao', 'documento_original'])
        delete corpo[k]
    }
    try {
      const r = documento
        ? await documentosApi.atualizar(documento.id, { ...corpo, versao: documento.versao })
        : await documentosApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['documentos-consultor'] })
      qc.invalidateQueries({ queryKey: ['comissoes'] })
      qc.setQueryData(['documentos-consultor', String(r.id)], r)
      navegar(`/faturacao/documentos/${r.id}`, { replace: !documento })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos as Record<string, string[]>)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  const texto = (k: keyof Valores, rotulo: string, extra: Partial<Parameters<typeof CampoTexto>[0]> = {}) => (
    <CampoTexto rotulo={rotulo} value={v[k]} onChange={(e) => mudar(k, e.target.value)} erro={erros[k]} {...extra} />
  )
  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'comissao':
        return (
          <CampoTexto
            rotulo="Comissão"
            value={c ? `${c.referencia} · ${c.transacao_referencia}` : '…'}
            disabled
            readOnly
          />
        )
      case 'consultor':
        return (
          <CampoSelecao
            rotulo="Consultor"
            required
            vazio="—"
            value={v.consultor}
            disabled={comPagamentos}
            onChange={(e) => setV((a) => ({ ...a, consultor: e.target.value, prestacao: '', documento_original: '' }))}
            opcoes={consultores.map(([id, nome]) => ({ valor: id, nome }))}
            erro={erros.consultor}
          />
        )
      case 'prestacao':
        return (
          <CampoSelecao
            rotulo="Prestação"
            vazio="— (sem prestação)"
            value={v.prestacao}
            onChange={(e) => mudar('prestacao', e.target.value)}
            opcoes={prestacoes.map((p) => ({ valor: p.id!, nome: `${p.momento_nome} · ${formatarEuros(p.valor)}` }))}
            erro={erros.prestacao}
          />
        )
      case 'tipo':
        return (
          <CampoSelecao
            rotulo="Tipo de documento"
            required
            vazio="—"
            value={v.tipo}
            disabled={comPagamentos}
            onChange={(e) => mudar('tipo', e.target.value)}
            opcoes={(opcoes.data?.tipos ?? []).map((x) => ({ valor: x.id, nome: x.nome }))}
            erro={erros.tipo}
          />
        )
      case 'documento_original':
        return credito ? (
          <CampoSelecao
            rotulo="Documento retificado"
            required
            vazio="—"
            value={v.documento_original}
            disabled={comPagamentos}
            onChange={(e) => mudar('documento_original', e.target.value)}
            opcoes={(outros.data?.results ?? [])
              .filter((d) => d.tipo_categoria !== 'credito' && d.id !== documento?.id)
              .map((d) => ({ valor: d.id, nome: `${d.tipo_nome} ${[d.serie, d.numero].filter(Boolean).join('/')}` }))}
            erro={erros.documento_original}
          />
        ) : null
      case 'serie':
        return texto('serie', 'Série')
      case 'numero':
        return texto('numero', 'Número', { required: true })
      case 'data_emissao':
        return texto('data_emissao', 'Data de emissão', { type: 'date', required: true })
      case 'base':
        return texto('base', 'Base, sem IVA (€)', { inputMode: 'decimal', required: true, disabled: comPagamentos })
      case 'taxa_iva':
        return texto('taxa_iva', 'Taxa de IVA (%)', { inputMode: 'decimal', disabled: comPagamentos })
      case 'iva':
        return texto('iva', 'IVA (€)', {
          inputMode: 'decimal',
          disabled: comPagamentos,
          placeholder: ivaCalculado !== null ? `Calculado: ${ivaCalculado.toFixed(2).replace('.', ',')}` : undefined,
          ajuda: 'Vazio: calcula-se pela taxa. Indique-o só se o documento tiver outro valor.',
        })
      case 'retencao':
        return texto('retencao', 'Retenção na fonte (€)', {
          inputMode: 'decimal',
          disabled: comPagamentos,
          ajuda: 'Valor indicado no documento (o CRM não calcula retenções).',
        })
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

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Faturação e Comissões"
        caminho="/faturacao/documentos"
        referencia={documento?.referencia ?? 'Novo'}
        titulo={documento ? 'Editar documento' : 'Registar documento de consultor'}
      />
      {comPagamentos && (
        <p className="aviso-duplicados">
          Este documento já tem pagamentos: os valores não mudam. Para os corrigir, registe uma nota de crédito.
        </p>
      )}
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <BlocosConfiguraveis
        def={ECRA_DOCUMENTO}
        modo="editar"
        personalizados={cp}
        campo={desenharCampo}
        erros={erros}
        abertoInicial={(b) => b.chave !== 'observacoes' || !!v.observacoes}
      />
      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() =>
            navegar(documento ? `/faturacao/documentos/${documento.id}` : `/faturacao/comissoes/${comissaoId}`)
          }
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
