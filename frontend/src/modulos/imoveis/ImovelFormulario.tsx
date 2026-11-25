import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { CampoMultiplo, CampoSelecao } from '../../componentes/campos'
import {
  qualificacaoParaApi,
  valoresQualificacao,
  type Opcoes,
  type Registo,
} from '../../componentes/camposQualificacao'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { EditarCampoQ } from '../../componentes/Qualificacao'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { SeletorLocalizacao } from '../../componentes/SeletorLocalizacao'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { CAMPOS_IMOVEL, etiquetaStatus, imoveisApi, tituloImovel, type Imovel } from './api'
import { ECRA_IMOVEL, IMOVEL_SECUNDARIOS } from './disposicao'

interface ProprietarioEditavel {
  entidade: OpcaoPesquisa
  /** Entidades sem acesso mantêm-se, mas não podem ser alteradas. */
  acessivel: boolean
  quota: string
}

/** Operação, estado de comercialização, status, localização CAOP, zonas exteriores e proprietários têm
 * componentes próprios; todos os outros campos vêm das listas de campos por separador (`api.ts`). */
interface Valores {
  responsavel: string
  operacao: string
  estado_comercializacao: string
  status: string
  freguesia: number | null
  zonas_exteriores: number[]
  proprietarios: ProprietarioEditavel[]
  extra: Record<string, string>
}

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))

const VAZIO: Valores = {
  responsavel: '',
  operacao: '',
  estado_comercializacao: '',
  status: '',
  freguesia: null,
  zonas_exteriores: [],
  proprietarios: [],
  extra: valoresQualificacao(CAMPOS_IMOVEL),
}

function deImovel(i: Imovel): Valores {
  return {
    responsavel: String(i.responsavel),
    operacao: t(i.operacao),
    estado_comercializacao: t(i.estado_comercializacao),
    status: t(i.status),
    freguesia: i.freguesia,
    zonas_exteriores: i.zonas_exteriores,
    proprietarios: i.proprietarios_detalhe.map((p) => ({
      entidade: {
        id: p.entidade,
        titulo: p.nome_completo ?? 'Entidade a que não tem acesso',
        detalhe: p.referencia ?? undefined,
      },
      acessivel: p.acessivel,
      quota: t(p.quota === null ? null : Number(p.quota)),
    })),
    extra: valoresQualificacao(CAMPOS_IMOVEL, i as unknown as Registo),
  }
}

const id = (v: string) => (v ? Number(v) : null)
const num = (v: string) => (v.trim() === '' ? null : v.trim().replace(',', '.'))

function paraApi(v: Valores) {
  return {
    responsavel: v.responsavel ? Number(v.responsavel) : undefined,
    operacao: id(v.operacao),
    estado_comercializacao: id(v.estado_comercializacao),
    status: id(v.status),
    freguesia: v.freguesia,
    zonas_exteriores: v.zonas_exteriores,
    proprietarios: v.proprietarios.map((p) => ({ entidade: p.entidade.id, quota: num(p.quota) })),
    ...qualificacaoParaApi(CAMPOS_IMOVEL, v.extra),
  }
}

export function ImovelNovo() {
  return <Formulario />
}

export function ImovelEditar() {
  const { id: pk = '' } = useParams()
  const { data, error, isLoading } = useQuery({ queryKey: ['imoveis', pk], queryFn: () => imoveisApi.obter(pk) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Imóvel não encontrado ou sem acesso.</p>
  if (!data) return <p className="erro">Não foi possível carregar o imóvel.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar este imóvel.</p>
  return <Formulario imovel={data} key={data.versao} />
}

function Formulario({ imovel }: { imovel?: Imovel }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const inicial = useMemo(() => (imovel ? deImovel(imovel) : VAZIO), [imovel])
  const [v, setV] = useState<Valores>(inicial)
  const [erros, setErros] = useState<Record<string, unknown>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [novoProprietario, setNovoProprietario] = useState<OpcaoPesquisa | null>(null)
  const opcoes = useQuery({ queryKey: ['imoveis', 'opcoes'], queryFn: imoveisApi.opcoes, staleTime: 60_000 })
  const cp = usePersonalizados(ECRA_IMOVEL, comoRegistoCp(imovel))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial) || cp.alterado)
  const o = opcoes.data

  const mudar = <K extends keyof Valores>(campo: K, valor: Valores[K]) => setV((a) => ({ ...a, [campo]: valor }))
  const erro = (c: string) => erros[c] as string[] | undefined
  const mudarExtra = (c: string, x: string) => setV((a) => ({ ...a, extra: { ...a.extra, [c]: x } }))
  const ctx = {
    nomesAtuais: imovel?.nomes,
    todos: CAMPOS_IMOVEL,
    valores: v.extra,
    aoMudar: mudarExtra,
    opcoes: o as unknown as Opcoes | undefined,
    erros: erros as Record<string, string[] | undefined>,
  }
  const lista = (itens?: { id: number; nome: string }[]) => (itens ?? []).map((x) => ({ valor: x.id, nome: x.nome }))
  // Valores desativados que o imóvel já tem continuam a aparecer na lista.
  const comAtual = (itens: { valor: number | string; nome: string }[], atual: string, nome: string | null) =>
    atual && nome && !itens.some((x) => String(x.valor) === atual) ? [...itens, { valor: atual, nome }] : itens

  const somaQuotas = v.proprietarios.reduce((s, p) => s + (p.quota ? Number(p.quota.replace(',', '.')) : 0), 0)

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    try {
      const corpo = paraApi(v)
      const r = imovel
        ? await imoveisApi.atualizar(imovel.id, {
            ...corpo,
            campos_personalizados: cp.paraApi(),
            versao: imovel.versao,
          })
        : await imoveisApi.criar({ ...corpo, campos_personalizados: cp.paraApi() })
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      qc.invalidateQueries({ queryKey: ['entidades'] })
      qc.setQueryData(['imoveis', String(r.id)], r)
      navegar(`/imoveis/${r.id}`, { replace: !imovel })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else if (err instanceof ErroApi) {
        setErroGeral(err.message)
      } else {
        setErroGeral('Não foi possível gravar. Verifique a ligação e tente de novo.')
      }
    } finally {
      setAGravar(false)
    }
  }

  const n = imovel?.nomes
  const proprietarios = (
    <>
      {v.proprietarios.length === 0 && <p className="ajuda">Sem proprietários.</p>}
      <ul className="lista-proprietarios">
        {v.proprietarios.map((p, i) => (
          <li key={p.entidade.id}>
            <span className="proprietario-nome">
              {p.acessivel ? <strong>{p.entidade.titulo}</strong> : <span className="vazio">{p.entidade.titulo}</span>}
              {p.entidade.detalhe && <small className="ajuda"> {p.entidade.detalhe}</small>}
            </span>
            <label className="quota">
              Quota (%)
              <input
                inputMode="decimal"
                value={p.quota}
                disabled={!p.acessivel}
                onChange={(e) =>
                  mudar(
                    'proprietarios',
                    v.proprietarios.map((x, j) => (j === i ? { ...x, quota: e.target.value } : x)),
                  )
                }
              />
            </label>
            {p.acessivel && (
              <button
                type="button"
                className="botao-icone"
                aria-label={`Remover ${p.entidade.titulo}`}
                onClick={() =>
                  mudar(
                    'proprietarios',
                    v.proprietarios.filter((_, j) => j !== i),
                  )
                }
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {v.proprietarios.length > 0 && (
        <p className={somaQuotas > 100 ? 'campo-erro' : 'ajuda'}>
          Soma das quotas indicadas: {somaQuotas.toLocaleString('pt-PT')} %{somaQuotas > 100 && ' (máximo 100 %)'}
        </p>
      )}
      {erro('proprietarios') && (
        <p className="campo-erro" role="alert">
          {erro('proprietarios')!.join(' ')}
        </p>
      )}
      <div className="novo-proprietario">
        <SeletorPesquisavel
          rotulo="Acrescentar proprietário"
          chave="entidades"
          procurar={entidadesApi.procurar}
          valor={novoProprietario}
          aoMudar={(e) => {
            if (e) {
              mudar('proprietarios', [...v.proprietarios, { entidade: e, acessivel: true, quota: '' }])
              setNovoProprietario(null)
            }
          }}
          excluir={v.proprietarios.map((p) => p.entidade.id)}
          placeholder="Nome, NIF ou referência da entidade…"
        />
        <Link to="/entidades/nova" target="_blank" className="ligacao-secundaria">
          Criar nova entidade
        </Link>
      </div>
    </>
  )
  function desenharCampo(c: string) {
    const q = CAMPOS_IMOVEL.find((x) => x.campo === c)
    if (q) return <EditarCampoQ c={q} ctx={ctx} />
    switch (c) {
      case 'operacao':
        return (
          <CampoSelecao
            rotulo="Operação"
            required
            value={v.operacao}
            onChange={(e) => mudar('operacao', e.target.value)}
            vazio="—"
            opcoes={comAtual(lista(o?.operacoes), v.operacao, n?.operacao ?? null)}
            erro={erro('operacao')}
          />
        )
      case 'estado_comercializacao':
        return (
          <CampoSelecao
            rotulo="Estado de comercialização"
            vazio="—"
            value={v.estado_comercializacao}
            onChange={(e) => mudar('estado_comercializacao', e.target.value)}
            opcoes={comAtual(
              lista(o?.estados_comercializacao),
              v.estado_comercializacao,
              n?.estado_comercializacao ?? null,
            )}
            erro={erro('estado_comercializacao')}
          />
        )
      case 'status':
        return (
          <CampoSelecao
            rotulo="Status"
            value={v.status}
            onChange={(e) => mudar('status', e.target.value)}
            vazio={imovel ? undefined : 'Por omissão: ativo'}
            opcoes={comAtual(lista(o?.status), v.status, n?.status ?? null)}
            erro={erro('status')}
          />
        )
      case 'responsavel':
        return (
          <CampoResponsavel
            modulo="imoveis"
            valor={v.responsavel}
            atual={imovel ? { id: imovel.responsavel, nome: imovel.responsavel_nome } : null}
            aoMudar={(x) => mudar('responsavel', x)}
            erro={erro('responsavel')}
          />
        )
      case 'zonas_exteriores':
        return (
          <CampoMultiplo
            rotulo="Zonas exteriores"
            opcoes={o?.zonas_exteriores ?? []}
            valores={v.zonas_exteriores}
            aoMudar={(z) => mudar('zonas_exteriores', z)}
            erro={erro('zonas_exteriores')}
          />
        )
      case 'freguesia':
        return (
          <Largo>
            <div className="grelha-campos">
              <SeletorLocalizacao
                freguesia={v.freguesia}
                atual={imovel?.freguesia === v.freguesia ? imovel?.localizacao : null}
                aoMudar={(f) => mudar('freguesia', f)}
              />
            </div>
          </Largo>
        )
      case 'proprietarios':
        return <Largo>{proprietarios}</Largo>
    }
    return null
  }
  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      {imovel ? (
        <CabecalhoRegisto
          modulo="Imóveis"
          caminho="/imoveis"
          referencia={imovel.referencia}
          titulo={tituloImovel({ tipo: n?.tipo, tipologia: n?.tipologia, localidade: imovel.localidade })}
          etiqueta={n?.status ? { texto: n.status, tipo: etiquetaStatus(n.status_categoria) } : undefined}
        />
      ) : (
        <CabecalhoRegisto modulo="Imóveis" caminho="/imoveis" referencia="Novo" titulo="Novo imóvel" />
      )}
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_IMOVEL}
        modo="editar"
        personalizados={cp}
        campo={desenharCampo}
        erros={erros}
        abertoInicial={(b) => !imovel || !IMOVEL_SECUNDARIOS.has(b.chave) || b.campos.some((c) => v.extra[c])}
      />

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(imovel ? `/imoveis/${imovel.id}` : '/imoveis')}
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
