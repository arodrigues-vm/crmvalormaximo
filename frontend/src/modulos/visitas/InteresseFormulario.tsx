import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao } from '../../componentes/campos'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { imoveisApi, procurarImoveis } from '../imoveis/api'
import { interessesApi, type Interesse } from './api'
import { ECRA_INTERESSE } from './disposicao'

const t = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const id = (v: string) => (v ? Number(v) : null)

export function InteresseNovo() {
  const [params] = useSearchParams()
  const imovelId = params.get('imovel')
  const entidadeId = params.get('entidade')
  const imovel = useQuery({
    queryKey: ['imoveis', imovelId],
    queryFn: () => imoveisApi.obter(imovelId!),
    enabled: !!imovelId,
  })
  const entidade = useQuery({
    queryKey: ['entidades', entidadeId],
    queryFn: () => entidadesApi.obter(entidadeId!),
    enabled: !!entidadeId,
  })
  if ((imovelId && imovel.isLoading) || (entidadeId && entidade.isLoading))
    return <p className="a-carregar">A carregar…</p>
  const i = imovel.data
  const e = entidade.data
  return (
    <Formulario
      imovelInicial={i ? { id: i.id, titulo: i.referencia, detalhe: i.localidade } : null}
      entidadeInicial={e ? { id: e.id, titulo: e.nome_completo, detalhe: e.referencia } : null}
    />
  )
}

export function InteresseEditar() {
  const { id: pk = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['interesses', pk], queryFn: () => interessesApi.obter(pk) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Interesse não encontrado ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar este interesse.</p>
  return <Formulario interesse={data} key={data.versao} />
}

function Formulario({
  interesse,
  imovelInicial = null,
  entidadeInicial = null,
}: {
  interesse?: Interesse
  imovelInicial?: OpcaoPesquisa | null
  entidadeInicial?: OpcaoPesquisa | null
}) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['interesses', 'opcoes'], queryFn: interessesApi.opcoes, staleTime: 60_000 })
  const o = opcoes.data
  const inicial = useMemo(
    () => ({
      entidade: interesse
        ? { id: interesse.entidade, titulo: interesse.entidade_nome ?? 'Entidade a que não tem acesso' }
        : entidadeInicial,
      imovel: interesse ? { id: interesse.imovel, titulo: interesse.imovel_descricao } : imovelInicial,
      origem: t(interesse?.origem),
      grau: t(interesse?.grau),
      estado: t(interesse?.estado),
      observacoes: interesse?.observacoes ?? '',
    }),
    [interesse, imovelInicial, entidadeInicial],
  )
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const mudar = <K extends keyof typeof v>(c: K, x: (typeof v)[K]) => setV((a) => ({ ...a, [c]: x }))
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo = {
      entidade: v.entidade?.id ?? null,
      imovel: v.imovel?.id ?? null,
      origem: id(v.origem),
      grau: id(v.grau),
      estado: id(v.estado),
      observacoes: v.observacoes,
    }
    try {
      const r = interesse
        ? await interessesApi.atualizar(interesse.id, { ...corpo, versao: interesse.versao })
        : await interessesApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['interesses'] })
      qc.setQueryData(['interesses', String(r.id)], r)
      navegar(`/visitas/interesses/${r.id}`, { replace: !interesse })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  function desenharCampo(c: string): ReactNode {
    switch (c) {
      case 'entidade':
        return (
          <SeletorPesquisavel
            rotulo="Cliente"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={v.entidade}
            aoMudar={(x) => mudar('entidade', x)}
            erro={erros.entidade?.join(' ')}
          />
        )
      case 'imovel':
        return (
          <SeletorPesquisavel
            rotulo="Imóvel"
            chave="imoveis"
            procurar={procurarImoveis}
            valor={v.imovel}
            aoMudar={(x) => mudar('imovel', x)}
            erro={erros.imovel?.join(' ')}
            placeholder="Ex.: 10 T3 Maia"
          />
        )
      case 'origem':
        return (
          <CampoSelecao
            rotulo="Origem"
            vazio="—"
            value={v.origem}
            onChange={(e) => mudar('origem', e.target.value)}
            opcoes={lista(o?.origens)}
          />
        )
      case 'grau':
        return (
          <CampoSelecao
            rotulo="Grau de interesse"
            vazio="—"
            value={v.grau}
            onChange={(e) => mudar('grau', e.target.value)}
            opcoes={lista(o?.graus)}
          />
        )
      case 'estado':
        return (
          <CampoSelecao
            rotulo="Estado"
            vazio={interesse ? undefined : 'Por omissão: Ativo'}
            value={v.estado}
            onChange={(e) => mudar('estado', e.target.value)}
            opcoes={lista(o?.estados)}
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

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Interesses"
        caminho="/visitas/interesses"
        referencia={interesse?.referencia ?? 'Novo'}
        titulo={interesse ? 'Editar interesse' : 'Novo interesse'}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      <BlocosConfiguraveis def={ECRA_INTERESSE} modo="editar" campo={desenharCampo} erros={erros} />

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(interesse ? `/visitas/interesses/${interesse.id}` : '/visitas/interesses')}
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
