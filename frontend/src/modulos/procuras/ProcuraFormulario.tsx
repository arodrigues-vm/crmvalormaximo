import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoCaixa, CampoMultiplo, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { qualificacaoParaApi, valoresQualificacao, type Opcoes } from '../../componentes/camposQualificacao'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { EditarCampoQ } from '../../componentes/Qualificacao'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import {
  CRITERIOS_INFORMATIVOS,
  PRE_QUALIFICACAO_FINANCEIRA,
  procurarConcelhos,
  procurarFreguesias,
  procurasApi,
  QUALIFICACAO_COMPRADOR,
  type Importancia,
  type Procura,
} from './api'
import { ECRA_PROCURA } from './disposicao'

type Imp = Importancia
interface Valores {
  entidade: OpcaoPesquisa | null
  pretende: string
  estado: string
  urgencia: string
  qualificacao: Record<string, string>
  orcamento_max: string
  tolerancia_pct: string
  tipos: number[]
  imp_tipos: Imp
  tipologias: number[]
  imp_tipologias: Imp
  concelhos: OpcaoPesquisa[]
  freguesias: OpcaoPesquisa[]
  zonas_comerciais: number[]
  imp_localizacao: Imp
  quartos_min: string
  imp_quartos: Imp
  wcs_min: string
  imp_wcs: Imp
  area_min: string
  imp_area: Imp
  zonas_exteriores: number[]
  imp_zonas_exteriores: Imp
  exige_elevador: boolean
  imp_elevador: Imp
  estacionamento_min: string
  imp_estacionamento: Imp
  condicoes_fisicas: number[]
  imp_condicoes: Imp
  observacoes: string
}

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const num = (v: string) => (v.trim() === '' ? null : v.trim().replace(',', '.'))
const CAMPOS_Q = [...QUALIFICACAO_COMPRADOR, ...PRE_QUALIFICACAO_FINANCEIRA, ...CRITERIOS_INFORMATIVOS]

function deProcura(p?: Procura, entidade?: OpcaoPesquisa | null): Valores {
  return {
    entidade: p ? { id: p.entidade, titulo: p.entidade_nome ?? 'Entidade a que não tem acesso' } : (entidade ?? null),
    pretende: p?.pretende ?? 'comprar',
    estado: t(p?.estado),
    urgencia: t(p?.urgencia),
    qualificacao: valoresQualificacao(CAMPOS_Q, p as unknown as Record<string, unknown> | undefined),
    orcamento_max: p?.orcamento_max ? String(Number(p.orcamento_max)) : '',
    tolerancia_pct: p ? String(Number(p.tolerancia_pct)) : '0',
    tipos: p?.tipos ?? [],
    imp_tipos: p?.imp_tipos ?? 'obrigatorio',
    tipologias: p?.tipologias ?? [],
    imp_tipologias: p?.imp_tipologias ?? 'preferencial',
    concelhos: p?.nomes.concelhos.map((c) => ({ id: c.id, titulo: c.nome })) ?? [],
    freguesias: p?.nomes.freguesias.map((f) => ({ id: f.id, titulo: f.nome })) ?? [],
    zonas_comerciais: p?.zonas_comerciais ?? [],
    imp_localizacao: p?.imp_localizacao ?? 'obrigatorio',
    quartos_min: t(p?.quartos_min),
    imp_quartos: p?.imp_quartos ?? 'preferencial',
    wcs_min: t(p?.wcs_min),
    imp_wcs: p?.imp_wcs ?? 'preferencial',
    area_min: p?.area_min ? String(Number(p.area_min)) : '',
    imp_area: p?.imp_area ?? 'preferencial',
    zonas_exteriores: p?.zonas_exteriores ?? [],
    imp_zonas_exteriores: p?.imp_zonas_exteriores ?? 'preferencial',
    exige_elevador: p?.exige_elevador ?? false,
    imp_elevador: p?.imp_elevador ?? 'preferencial',
    estacionamento_min: t(p?.estacionamento_min),
    imp_estacionamento: p?.imp_estacionamento ?? 'preferencial',
    condicoes_fisicas: p?.condicoes_fisicas ?? [],
    imp_condicoes: p?.imp_condicoes ?? 'preferencial',
    observacoes: p?.observacoes ?? '',
  }
}

/** Uma linha de critério com o seletor Obrigatório / Preferencial. */
function Criterio({
  titulo,
  ajuda,
  imp,
  aoMudarImp,
  children,
}: {
  titulo: string
  ajuda?: string
  imp: Imp
  aoMudarImp: (i: Imp) => void
  children: ReactNode
}) {
  return (
    <div className="criterio-linha">
      <div>
        <strong>{titulo}</strong>
        {ajuda && <p className="ajuda">{ajuda}</p>}
        <div className="grelha-campos">{children}</div>
      </div>
      <div className="importancia" role="radiogroup" aria-label={`Importância: ${titulo}`}>
        {(['obrigatorio', 'preferencial'] as Imp[]).map((i) => (
          <label key={i}>
            <input type="radio" checked={imp === i} onChange={() => aoMudarImp(i)} />
            {i === 'obrigatorio' ? 'Obrigatório' : 'Preferencial'}
          </label>
        ))}
      </div>
    </div>
  )
}

function Escolhidos({ itens, aoRemover }: { itens: OpcaoPesquisa[]; aoRemover: (id: number) => void }) {
  if (!itens.length) return null
  return (
    <div className="fichas-escolhidas">
      {itens.map((i) => (
        <span key={i.id} className="pilula">
          {i.titulo}
          {i.detalhe && <small className="ajuda"> {i.detalhe}</small>}
          <button
            type="button"
            className="ligacao-botao"
            aria-label={`Retirar ${i.titulo}`}
            onClick={() => aoRemover(i.id)}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}

export function ProcuraNova() {
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

export function ProcuraEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['procuras', id], queryFn: () => procurasApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Procura não encontrada ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta procura.</p>
  return <Formulario p={data} key={data.versao} />
}

function Formulario({ p, entidadeInicial = null }: { p?: Procura; entidadeInicial?: OpcaoPesquisa | null }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const inicial = useMemo(() => deProcura(p, entidadeInicial), [p, entidadeInicial])
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [novoConcelho, setNovoConcelho] = useState<OpcaoPesquisa | null>(null)
  const [novaFreguesia, setNovaFreguesia] = useState<OpcaoPesquisa | null>(null)
  const opcoes = useQuery({ queryKey: ['procuras', 'opcoes'], queryFn: procurasApi.opcoes, staleTime: 60_000 })
  const cp = usePersonalizados(ECRA_PROCURA, comoRegistoCp(p))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial) || cp.alterado)
  const o = opcoes.data
  const mudar = <K extends keyof Valores>(c: K, valor: Valores[K]) => setV((a) => ({ ...a, [c]: valor }))
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))
  const mudarQ = (c: string, x: string) => setV((a) => ({ ...a, qualificacao: { ...a.qualificacao, [c]: x } }))
  const opcoesQ = o as unknown as Opcoes | undefined
  const teto =
    v.orcamento_max && !isNaN(Number(num(v.orcamento_max)))
      ? Number(num(v.orcamento_max)) * (1 + Number(num(v.tolerancia_pct) ?? 0) / 100)
      : null

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo = {
      entidade: v.entidade?.id ?? null,
      pretende: v.pretende,
      estado: v.estado ? Number(v.estado) : null,
      urgencia: v.urgencia ? Number(v.urgencia) : null,
      ...qualificacaoParaApi(CAMPOS_Q, v.qualificacao),
      orcamento_max: num(v.orcamento_max),
      tolerancia_pct: num(v.tolerancia_pct) ?? '0',
      tipos: v.tipos,
      imp_tipos: v.imp_tipos,
      tipologias: v.tipologias,
      imp_tipologias: v.imp_tipologias,
      concelhos: v.concelhos.map((c) => c.id),
      freguesias: v.freguesias.map((f) => f.id),
      zonas_comerciais: v.zonas_comerciais,
      imp_localizacao: v.imp_localizacao,
      quartos_min: num(v.quartos_min),
      imp_quartos: v.imp_quartos,
      wcs_min: num(v.wcs_min),
      imp_wcs: v.imp_wcs,
      area_min: num(v.area_min),
      imp_area: v.imp_area,
      zonas_exteriores: v.zonas_exteriores,
      imp_zonas_exteriores: v.imp_zonas_exteriores,
      exige_elevador: v.exige_elevador,
      imp_elevador: v.imp_elevador,
      estacionamento_min: num(v.estacionamento_min),
      imp_estacionamento: v.imp_estacionamento,
      condicoes_fisicas: v.condicoes_fisicas,
      imp_condicoes: v.imp_condicoes,
      observacoes: v.observacoes,
    }
    try {
      const r = p
        ? await procurasApi.atualizar(p.id, { ...corpo, campos_personalizados: cp.paraApi(), versao: p.versao })
        : await procurasApi.criar({ ...corpo, campos_personalizados: cp.paraApi() })
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['procuras'] })
      qc.setQueryData(['procuras', String(r.id)], r)
      navegar(`/procuras/${r.id}`, { replace: !p })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  const ctxQ = {
    nomesAtuais: p?.nomes,
    todos: CAMPOS_Q,
    valores: v.qualificacao,
    aoMudar: mudarQ,
    opcoes: opcoesQ,
    erros,
  }
  function desenharCampo(c: string): ReactNode {
    const q = CAMPOS_Q.find((x) => x.campo === c)
    if (q) return <EditarCampoQ c={q} ctx={ctxQ} />
    switch (c) {
      case 'entidade':
        return (
          <SeletorPesquisavel
            rotulo="Comprador / arrendatário"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={v.entidade}
            aoMudar={(x) => mudar('entidade', x)}
            erro={erros.entidade?.join(' ')}
          />
        )
      case 'pretende':
        return (
          <CampoSelecao
            rotulo="O cliente pretende"
            required
            value={v.pretende}
            onChange={(e) => mudar('pretende', e.target.value)}
            opcoes={o?.pretende ?? []}
            erro={erros.pretende}
          />
        )
      case 'estado':
        return (
          <CampoSelecao
            rotulo="Estado"
            vazio={p ? undefined : 'Por omissão: Ativa'}
            value={v.estado}
            onChange={(e) => mudar('estado', e.target.value)}
            opcoes={lista(o?.estados)}
          />
        )
      case 'urgencia':
        return (
          <CampoSelecao
            rotulo="Urgência"
            vazio="—"
            value={v.urgencia}
            onChange={(e) => mudar('urgencia', e.target.value)}
            opcoes={lista(o?.urgencias)}
          />
        )
      case 'orcamento_max':
        return (
          <CampoTexto
            rotulo="Valor de aquisição previsto (€)"
            inputMode="decimal"
            value={v.orcamento_max}
            onChange={(e) => mudar('orcamento_max', e.target.value)}
            erro={erros.orcamento_max}
          />
        )
      case 'tolerancia_pct':
        return (
          <>
            <CampoTexto
              rotulo="Tolerância (%)"
              inputMode="decimal"
              value={v.tolerancia_pct}
              onChange={(e) => mudar('tolerancia_pct', e.target.value)}
              erro={erros.tolerancia_pct}
              ajuda="De 0% a 20%. Imóveis acima deste valor + tolerância nunca aparecem nas correspondências."
            />
            {teto !== null && (
              <p className="ajuda largo">
                Preço máximo aceite: <strong>{teto.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} €</strong>
              </p>
            )}
          </>
        )
      case 'explicacao_criterios':
        return (
          <p className="ajuda largo">
            <strong>Obrigatório</strong>: imóveis que não cumprem ficam de fora. <strong>Preferencial</strong>: só ajuda
            a ordenar. Critérios deixados em branco não contam.
          </p>
        )
      case 'nota_informativos':
        return <h4 className="subtitulo-bloco largo">Outras preferências (não entram nas correspondências)</h4>
      case 'crit_tipos':
        return (
          <Largo>
            <Criterio titulo="Tipo de imóvel" imp={v.imp_tipos} aoMudarImp={(i) => mudar('imp_tipos', i)}>
              <CampoMultiplo
                rotulo="Tipos aceites"
                opcoes={o?.tipos_imovel ?? []}
                valores={v.tipos}
                aoMudar={(x) => mudar('tipos', x)}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_tipologias':
        return (
          <Largo>
            <Criterio titulo="Tipologia" imp={v.imp_tipologias} aoMudarImp={(i) => mudar('imp_tipologias', i)}>
              <CampoMultiplo
                rotulo="Tipologias pretendidas"
                opcoes={o?.tipologias ?? []}
                valores={v.tipologias}
                aoMudar={(x) => mudar('tipologias', x)}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_localizacao':
        return (
          <Largo>
            <Criterio
              titulo="Localização"
              ajuda="Basta cumprir uma: um concelho inteiro, uma freguesia específica ou uma zona comercial."
              imp={v.imp_localizacao}
              aoMudarImp={(i) => mudar('imp_localizacao', i)}
            >
              <div className="campo">
                <SeletorPesquisavel
                  rotulo="Concelhos"
                  chave="concelhos"
                  procurar={procurarConcelhos}
                  valor={novoConcelho}
                  excluir={v.concelhos.map((c) => c.id)}
                  aoMudar={(c) => {
                    if (c) {
                      mudar('concelhos', [...v.concelhos, c])
                      setNovoConcelho(null)
                    }
                  }}
                />
                <Escolhidos
                  itens={v.concelhos}
                  aoRemover={(id) =>
                    mudar(
                      'concelhos',
                      v.concelhos.filter((c) => c.id !== id),
                    )
                  }
                />
              </div>
              <div className="campo">
                <SeletorPesquisavel
                  rotulo="Freguesias"
                  chave="freguesias"
                  procurar={procurarFreguesias}
                  valor={novaFreguesia}
                  excluir={v.freguesias.map((f) => f.id)}
                  aoMudar={(f) => {
                    if (f) {
                      mudar('freguesias', [...v.freguesias, f])
                      setNovaFreguesia(null)
                    }
                  }}
                />
                <Escolhidos
                  itens={v.freguesias}
                  aoRemover={(id) =>
                    mudar(
                      'freguesias',
                      v.freguesias.filter((f) => f.id !== id),
                    )
                  }
                />
              </div>
              <CampoMultiplo
                rotulo="Zonas"
                opcoes={o?.zonas_comerciais ?? []}
                valores={v.zonas_comerciais}
                aoMudar={(x) => mudar('zonas_comerciais', x)}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_area':
        return (
          <Largo>
            <Criterio
              titulo="Área bruta privativa"
              ajuda="Compara com a área bruta privativa (ou a útil, se aquela faltar)."
              imp={v.imp_area}
              aoMudarImp={(i) => mudar('imp_area', i)}
            >
              <CampoTexto
                rotulo="Mínimo (m²)"
                inputMode="decimal"
                value={v.area_min}
                onChange={(e) => mudar('area_min', e.target.value)}
                erro={erros.area_min}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_quartos':
        return (
          <Largo>
            <Criterio titulo="Quartos" imp={v.imp_quartos} aoMudarImp={(i) => mudar('imp_quartos', i)}>
              <CampoTexto
                rotulo="Mínimo de quartos"
                inputMode="numeric"
                value={v.quartos_min}
                onChange={(e) => mudar('quartos_min', e.target.value)}
                erro={erros.quartos_min}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_wcs':
        return (
          <Largo>
            <Criterio titulo="Casas de banho" imp={v.imp_wcs} aoMudarImp={(i) => mudar('imp_wcs', i)}>
              <CampoTexto
                rotulo="Mínimo de casas de banho"
                inputMode="numeric"
                value={v.wcs_min}
                onChange={(e) => mudar('wcs_min', e.target.value)}
                erro={erros.wcs_min}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_elevador':
        return (
          <Largo>
            <Criterio titulo="Elevador" imp={v.imp_elevador} aoMudarImp={(i) => mudar('imp_elevador', i)}>
              <CampoCaixa
                rotulo="Precisa de elevador"
                checked={v.exige_elevador}
                onChange={(e) => mudar('exige_elevador', e.target.checked)}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_estacionamento':
        return (
          <Largo>
            <Criterio
              titulo="Estacionamento"
              imp={v.imp_estacionamento}
              aoMudarImp={(i) => mudar('imp_estacionamento', i)}
            >
              <CampoTexto
                rotulo="Mínimo de lugares"
                inputMode="numeric"
                value={v.estacionamento_min}
                onChange={(e) => mudar('estacionamento_min', e.target.value)}
                erro={erros.estacionamento_min}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_zonas_exteriores':
        return (
          <Largo>
            <Criterio
              titulo="Zonas exteriores"
              ajuda="O imóvel tem de ter todas as escolhidas."
              imp={v.imp_zonas_exteriores}
              aoMudarImp={(i) => mudar('imp_zonas_exteriores', i)}
            >
              <CampoMultiplo
                rotulo="Zonas exteriores"
                opcoes={o?.zonas_exteriores ?? []}
                valores={v.zonas_exteriores}
                aoMudar={(x) => mudar('zonas_exteriores', x)}
              />
            </Criterio>
          </Largo>
        )
      case 'crit_condicoes':
        return (
          <Largo>
            <Criterio titulo="Condição física" imp={v.imp_condicoes} aoMudarImp={(i) => mudar('imp_condicoes', i)}>
              <CampoMultiplo
                rotulo="Condições aceites"
                opcoes={o?.condicoes_fisicas ?? []}
                valores={v.condicoes_fisicas}
                aoMudar={(x) => mudar('condicoes_fisicas', x)}
              />
            </Criterio>
          </Largo>
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
        modulo="Procuras"
        caminho="/procuras"
        referencia={p?.referencia ?? 'Nova'}
        titulo={p ? 'Editar procura' : 'Nova procura'}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_PROCURA}
        modo="editar"
        personalizados={cp}
        campo={desenharCampo}
        erros={erros}
        abertoInicial={(b) => (b.chave === 'observacoes' ? !!v.observacoes : true)}
      />

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(p ? `/procuras/${p.id}` : '/procuras')}
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
