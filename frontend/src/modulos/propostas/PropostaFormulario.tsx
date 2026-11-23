import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { agentesApi } from '../agentes/api'
import { entidadesApi } from '../entidades/api'
import { procurarImoveis } from '../imoveis/api'
import { propostasApi, type Previa, type Proposta } from './api'
import { CamposRonda } from './CamposRonda'
import { RONDA_VAZIA, rondaParaApi, type ValoresRonda } from './ronda'

interface Parte {
  entidade: OpcaoPesquisa
  papel: string
  quota: string
}

interface Valores {
  imovelRegistado: boolean
  imovel: OpcaoPesquisa | null
  imovel_descricao: string
  imovel_localizacao: string
  entidade: OpcaoPesquisa | null
  agente_comprador: OpcaoPesquisa | null
  agente_imovel: OpcaoPesquisa | null
  estado: string
  participantes: Parte[]
  ronda: ValoresRonda
  observacoes: string
}

const t = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const op = (id: number | null, titulo: string | null): OpcaoPesquisa | null =>
  id ? { id, titulo: titulo ?? '' } : null

function dePrevia(p: Previa): Valores {
  return {
    imovelRegistado: p.imovel !== null,
    imovel: op(p.imovel, p.imovel_descricao_completa),
    imovel_descricao: p.imovel_descricao,
    imovel_localizacao: p.imovel_localizacao,
    entidade: op(p.entidade, p.entidade_nome),
    agente_comprador: op(p.agente_comprador, p.agente_comprador_nome),
    agente_imovel: op(p.agente_imovel, p.agente_imovel_nome),
    estado: '',
    participantes: p.participantes.map((x) => ({
      entidade: { id: x.entidade, titulo: x.nome },
      papel: t(x.papel),
      quota: x.quota ? String(Number(x.quota)) : '',
    })),
    ronda: { ...RONDA_VAZIA, valor: p.valor_sugerido ? String(Number(p.valor_sugerido)) : '' },
    observacoes: '',
  }
}

function deProposta(p: Proposta): Valores {
  return {
    imovelRegistado: p.imovel !== null,
    imovel: op(p.imovel, p.imovel_descricao_completa),
    imovel_descricao: p.imovel_descricao,
    imovel_localizacao: p.imovel_localizacao,
    entidade: op(p.entidade, p.entidade_nome ?? 'Entidade a que não tem acesso'),
    agente_comprador: op(p.agente_comprador, p.agente_comprador_nome),
    agente_imovel: op(p.agente_imovel, p.agente_imovel_nome),
    estado: t(p.estado),
    participantes: p.participantes_detalhe.map((x) => ({
      entidade: { id: x.entidade, titulo: x.nome },
      papel: t(x.papel),
      quota: x.quota ? String(Number(x.quota)) : '',
    })),
    ronda: RONDA_VAZIA,
    observacoes: p.observacoes,
  }
}

const VAZIO: Valores = {
  imovelRegistado: true,
  imovel: null,
  imovel_descricao: '',
  imovel_localizacao: '',
  entidade: null,
  agente_comprador: null,
  agente_imovel: null,
  estado: '',
  participantes: [],
  ronda: RONDA_VAZIA,
  observacoes: '',
}

/** «Gerar Proposta» a partir de uma visita (pré-preenchido; só grava ao confirmar) ou proposta nova em branco. */
export function PropostaNova() {
  const [params] = useSearchParams()
  const visita = params.get('visita')
  const previa = useQuery({
    queryKey: ['propostas', 'previa', visita],
    queryFn: () => propostasApi.previa(visita!),
    enabled: !!visita,
    retry: false,
  })
  if (visita && previa.isLoading) return <p className="a-carregar">A carregar…</p>
  if (visita && previa.error instanceof ErroApi && previa.error.estado === 409) {
    const existente = previa.error.corpo.proposta as number
    return (
      <p className="aviso">
        {previa.error.message} <Link to={`/propostas/${existente}`}>Abrir a proposta</Link>
      </p>
    )
  }
  if (visita && !previa.data) return <p className="aviso">Visita não encontrada ou sem acesso.</p>
  return <Formulario previa={previa.data} />
}

export function PropostaEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['propostas', id], queryFn: () => propostasApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Proposta não encontrada ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta proposta.</p>
  return <Formulario proposta={data} key={data.versao} />
}

function Formulario({ proposta, previa }: { proposta?: Proposta; previa?: Previa }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['propostas', 'opcoes'], queryFn: propostasApi.opcoes, staleTime: 60_000 })
  const o = opcoes.data
  const inicial = useMemo(
    () => (proposta ? deProposta(proposta) : previa ? dePrevia(previa) : VAZIO),
    [proposta, previa],
  )
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, unknown>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [novaParte, setNovaParte] = useState<OpcaoPesquisa | null>(null)
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const mudar = <K extends keyof Valores>(c: K, x: Valores[K]) => setV((a) => ({ ...a, [c]: x }))
  const erro = (c: string) => erros[c] as string[] | undefined
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))
  const daVisita = !!previa || !!proposta?.visita
  const errosRonda = (Array.isArray(erros.ronda_inicial) ? {} : (erros.ronda_inicial ?? {})) as Record<string, string[]>

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo: Record<string, unknown> = {
      imovel: v.imovelRegistado ? (v.imovel?.id ?? null) : null,
      imovel_descricao: v.imovelRegistado ? '' : v.imovel_descricao,
      imovel_localizacao: v.imovelRegistado ? '' : v.imovel_localizacao,
      entidade: v.entidade?.id ?? null,
      agente_comprador: v.agente_comprador?.id ?? null,
      agente_imovel: v.agente_imovel?.id ?? null,
      estado: v.estado ? Number(v.estado) : null,
      participantes: v.participantes.map((p) => ({
        entidade: p.entidade.id,
        papel: p.papel ? Number(p.papel) : null,
        quota: p.quota ? p.quota.replace(',', '.') : null,
      })),
      observacoes: v.observacoes,
    }
    if (!proposta) {
      corpo.visita = previa?.visita ?? null
      corpo.ronda_inicial = rondaParaApi(v.ronda)
    }
    try {
      const r = proposta
        ? await propostasApi.atualizar(proposta.id, { ...corpo, versao: proposta.versao })
        : await propostasApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['propostas'] })
      qc.setQueryData(['propostas', String(r.id)], r)
      navegar(`/propostas/${r.id}`, { replace: !proposta })
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
        modulo="Propostas"
        caminho="/propostas"
        referencia={proposta?.referencia ?? 'Nova'}
        titulo={
          proposta
            ? 'Editar proposta'
            : previa
              ? `Gerar proposta (visita ${previa.visita_referencia})`
              : 'Nova proposta'
        }
      />
      {previa && (
        <p className="aviso-duplicados">
          Dados preenchidos a partir da visita. Confirme o comprador, os participantes, o valor e as condições. A
          proposta só é criada quando carregar em <strong>Guardar</strong>.
        </p>
      )}
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <Bloco
        titulo="Proposta"
        forcarAberto={['imovel', 'entidade', 'agente_comprador', 'agente_imovel', 'estado', 'visita'].some(
          (c) => erros[c],
        )}
      >
        {erro('visita') && <p className="campo-erro">{erro('visita')!.join(' ')}</p>}
        <div className="grelha-campos">
          {!daVisita && (
            <CampoSelecao
              rotulo="O imóvel está registado no CRM?"
              value={v.imovelRegistado ? 'sim' : 'nao'}
              onChange={(e) => mudar('imovelRegistado', e.target.value === 'sim')}
              opcoes={[
                { valor: 'sim', nome: 'Sim' },
                { valor: 'nao', nome: 'Não (imóvel de agente externo ou da rede)' },
              ]}
            />
          )}
          {v.imovelRegistado ? (
            <SeletorPesquisavel
              rotulo="Imóvel"
              chave="imoveis"
              procurar={procurarImoveis}
              valor={v.imovel}
              aoMudar={(x) => !daVisita && mudar('imovel', x)}
              erro={erro('imovel')?.join(' ')}
              placeholder="Ex.: 10 T3 Maia"
            />
          ) : (
            <>
              <CampoTexto
                rotulo="Descrição do imóvel"
                value={v.imovel_descricao}
                disabled={daVisita}
                onChange={(e) => mudar('imovel_descricao', e.target.value)}
                erro={erro('imovel')}
              />
              <CampoTexto
                rotulo="Localização (breve)"
                value={v.imovel_localizacao}
                disabled={daVisita}
                onChange={(e) => mudar('imovel_localizacao', e.target.value)}
              />
            </>
          )}
          <SeletorPesquisavel
            rotulo="Comprador"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={v.entidade}
            aoMudar={(x) => !daVisita && mudar('entidade', x)}
            erro={erro('entidade')?.join(' ')}
          />
          <SeletorPesquisavel
            rotulo="Agente responsável pelo comprador"
            chave="agentes"
            procurar={agentesApi.procurar}
            valor={v.agente_comprador}
            aoMudar={(x) => mudar('agente_comprador', x)}
            erro={erro('agente_comprador')?.join(' ')}
          />
          <SeletorPesquisavel
            rotulo="Agente responsável pelo imóvel"
            chave="agentes"
            procurar={agentesApi.procurar}
            valor={v.agente_imovel}
            aoMudar={(x) => mudar('agente_imovel', x)}
            erro={erro('agente_imovel')?.join(' ')}
          />
          <CampoSelecao
            rotulo="Estado"
            vazio={proposta ? undefined : 'Por omissão: Em negociação'}
            value={v.estado}
            onChange={(e) => mudar('estado', e.target.value)}
            opcoes={lista(o?.estados)}
            erro={erro('estado')}
          />
        </div>
      </Bloco>

      <Bloco titulo="Participantes" forcarAberto={!!erros.participantes}>
        <p className="ajuda">
          Compradores, proprietários e representantes desta negociação, com os papéis e as quotas confirmados. Ficam
          guardados na proposta: alterações posteriores aos proprietários do imóvel não os mudam.
        </p>
        <ul className="lista-proprietarios">
          {v.participantes.map((p, i) => (
            <li key={p.entidade.id}>
              <span className="proprietario-nome">
                <strong>{p.entidade.titulo}</strong>
              </span>
              <select
                aria-label={`Papel de ${p.entidade.titulo}`}
                value={p.papel}
                onChange={(e) =>
                  mudar(
                    'participantes',
                    v.participantes.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)),
                  )
                }
              >
                <option value="">Papel…</option>
                {o?.papeis.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
              <label className="quota">
                Quota (%)
                <input
                  inputMode="decimal"
                  value={p.quota}
                  onChange={(e) =>
                    mudar(
                      'participantes',
                      v.participantes.map((x, j) => (j === i ? { ...x, quota: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="botao-icone"
                aria-label={`Remover ${p.entidade.titulo}`}
                onClick={() =>
                  mudar(
                    'participantes',
                    v.participantes.filter((_, j) => j !== i),
                  )
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        {erro('participantes') && <p className="campo-erro">{erro('participantes')!.join(' ')}</p>}
        <div className="novo-proprietario">
          <SeletorPesquisavel
            rotulo="Acrescentar participante"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={novaParte}
            aoMudar={(x) => {
              if (x) {
                mudar('participantes', [...v.participantes, { entidade: x, papel: '', quota: '' }])
                setNovaParte(null)
              }
            }}
            excluir={v.participantes.map((p) => p.entidade.id)}
          />
        </div>
      </Bloco>

      {!proposta && (
        <Bloco titulo="Valor e condições" forcarAberto={!!erros.ronda_inicial}>
          {Array.isArray(erros.ronda_inicial) && <p className="campo-erro">{erros.ronda_inicial.join(' ')}</p>}
          <CamposRonda v={v.ronda} aoMudar={(r) => mudar('ronda', r)} opcoes={o} erros={errosRonda} />
        </Bloco>
      )}

      <Bloco titulo="Observações" abertoInicial={!!v.observacoes}>
        <CampoAreaTexto
          rotulo="Observações"
          value={v.observacoes}
          onChange={(e) => mudar('observacoes', e.target.value)}
        />
      </Bloco>

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() =>
            navegar(proposta ? `/propostas/${proposta.id}` : previa ? `/visitas/${previa.visita}` : '/propostas')
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
