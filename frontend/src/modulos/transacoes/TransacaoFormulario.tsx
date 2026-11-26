import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { transacoesApi, type CmiEscolha, type PreviaTransacao, type Transacao } from './api'
import { ECRA_TRANSACAO } from './disposicao'

interface ParticipanteEditavel {
  entidade: OpcaoPesquisa
  papel: string
  quota: string
}

interface Valores {
  angariacao: string // '' = por escolher; 'sem' = sem CMI; senão o id
  operacao: string
  valor: string
  sinal_valor: string
  sinal_unidade: string
  data_cpcv_prevista: string
  data_cpcv: string
  data_escritura_prevista: string
  data_escritura: string
  participantes: ParticipanteEditavel[]
  responsavel: string
  observacoes: string
}

/** Contexto só de leitura (vem da proposta e não se muda na transação). */
interface Contexto {
  proposta: number
  propostaReferencia: string
  imovel: number | null
  imovelDescricao: string
  compradorNome: string | null
  responsavelImovel: string | null
  responsavelComprador: string | null
  estadoNome: string | null
  concluida: boolean
}

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const num = (v: string) => (v.trim() === '' ? null : v.trim().replace(/\s/g, '').replace(',', '.'))
const nulo = (v: string) => v || null

function dePrevia(p: PreviaTransacao): Valores {
  return {
    angariacao: p.cmi_sugerido ? String(p.cmi_sugerido) : '',
    operacao: t(p.operacao ?? p.cmis.find((c) => c.id === p.cmi_sugerido)?.operacao),
    valor: p.valor ? String(Number(p.valor)) : '',
    sinal_valor: p.sinal_valor ? String(Number(p.sinal_valor)) : '',
    sinal_unidade: p.sinal_unidade || (p.sinal_valor ? 'percentagem' : ''),
    data_cpcv_prevista: p.data_cpcv_prevista ?? '',
    data_cpcv: '',
    data_escritura_prevista: p.data_escritura_prevista ?? '',
    data_escritura: '',
    participantes: p.participantes.map((x) => ({
      entidade: { id: x.entidade, titulo: x.nome },
      papel: t(x.papel),
      quota: x.quota ? String(Number(x.quota)) : '',
    })),
    responsavel: '',
    observacoes: '',
  }
}

function deTransacao(x: Transacao): Valores {
  return {
    angariacao: x.angariacao ? String(x.angariacao) : 'sem',
    operacao: t(x.operacao),
    valor: String(Number(x.valor)),
    sinal_valor: x.sinal_valor ? String(Number(x.sinal_valor)) : '',
    sinal_unidade: x.sinal_unidade,
    data_cpcv_prevista: x.data_cpcv_prevista ?? '',
    data_cpcv: x.data_cpcv ?? '',
    data_escritura_prevista: x.data_escritura_prevista ?? '',
    data_escritura: x.data_escritura ?? '',
    participantes: x.participantes_detalhe.map((p) => ({
      entidade: { id: p.entidade, titulo: p.nome },
      papel: t(p.papel),
      quota: p.quota ? String(Number(p.quota)) : '',
    })),
    responsavel: String(x.responsavel),
    observacoes: x.observacoes,
  }
}

/** «Gerar Transação» (Q12): pré-preenchido a partir da proposta aceite; só grava ao confirmar. */
export function TransacaoNova() {
  const [params] = useSearchParams()
  const proposta = params.get('proposta')
  const previa = useQuery({
    queryKey: ['transacoes', 'previa', proposta],
    queryFn: () => transacoesApi.previa(proposta!),
    enabled: !!proposta,
    retry: false,
  })
  if (!proposta)
    return (
      <p className="aviso">
        Uma transação gera-se a partir de uma proposta aceite. Abra a proposta em <Link to="/propostas">Propostas</Link>{' '}
        e carregue em «Gerar Transação».
      </p>
    )
  if (previa.isLoading) return <p className="a-carregar">A carregar…</p>
  const e = previa.error
  if (e instanceof ErroApi) {
    const existente = e.corpo.transacao as number | undefined
    return (
      <p className="aviso">
        {e.message} {existente && <Link to={`/transacoes/${existente}`}>Abrir a transação</Link>}
      </p>
    )
  }
  if (!previa.data) return <p className="erro">Não foi possível preparar a transação.</p>
  const p = previa.data
  return (
    <Formulario
      inicial={dePrevia(p)}
      cmis={p.cmis}
      contexto={{
        proposta: p.proposta,
        propostaReferencia: p.proposta_referencia,
        imovel: p.imovel,
        imovelDescricao: p.imovel_descricao_completa,
        compradorNome: p.entidade_nome,
        responsavelImovel: p.responsavel_imovel_nome,
        responsavelComprador: p.responsavel_comprador_nome,
        estadoNome: null,
        concluida: false,
      }}
    />
  )
}

export function TransacaoEditar() {
  const { id = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['transacoes', id], queryFn: () => transacoesApi.obter(id) })
  const cmis = useQuery({
    queryKey: ['transacoes', id, 'cmis'],
    queryFn: () => transacoesApi.cmis(Number(id)),
    enabled: !!data,
  })
  if (isLoading || cmis.isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Transação não encontrada ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta transação.</p>
  return (
    <Formulario
      key={data.versao}
      transacao={data}
      inicial={deTransacao(data)}
      cmis={cmis.data ?? []}
      contexto={{
        proposta: data.proposta,
        propostaReferencia: data.proposta_referencia,
        imovel: data.imovel,
        imovelDescricao: data.imovel_descricao_completa,
        compradorNome: data.entidade_nome,
        responsavelImovel: data.responsavel_imovel_nome,
        responsavelComprador: data.responsavel_comprador_nome,
        estadoNome: data.estado_nome,
        concluida: data.estado_categoria === 'concluida',
      }}
    />
  )
}

function Formulario({
  transacao,
  inicial,
  cmis,
  contexto: ctx,
}: {
  transacao?: Transacao
  inicial: Valores
  cmis: CmiEscolha[]
  contexto: Contexto
}) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['transacoes', 'opcoes'], queryFn: transacoesApi.opcoes, staleTime: 60_000 })
  const o = opcoes.data
  const base = useMemo(() => inicial, [inicial])
  const [v, setV] = useState(base)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [novaParte, setNovaParte] = useState<OpcaoPesquisa | null>(null)
  const cp = usePersonalizados(ECRA_TRANSACAO, comoRegistoCp(transacao))
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(base) || cp.alterado)
  const mudar = <K extends keyof Valores>(c: K, x: Valores[K]) => setV((a) => ({ ...a, [c]: x }))
  const erro = (c: string) => erros[c]
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))
  const arrendamento = o?.operacoes.find((x) => String(x.id) === v.operacao)?.categoria === 'arrendamento'

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo: Record<string, unknown> = {
      operacao: v.operacao ? Number(v.operacao) : undefined,
      valor: num(v.valor),
      sinal_valor: num(v.sinal_valor),
      sinal_unidade: v.sinal_valor.trim() ? v.sinal_unidade : '',
      data_cpcv_prevista: nulo(v.data_cpcv_prevista),
      data_cpcv: nulo(v.data_cpcv),
      data_escritura_prevista: nulo(v.data_escritura_prevista),
      data_escritura: nulo(v.data_escritura),
      participantes: v.participantes.map((p) => ({
        entidade: p.entidade.id,
        papel: p.papel ? Number(p.papel) : null,
        quota: num(p.quota),
      })),
      responsavel: v.responsavel ? Number(v.responsavel) : undefined,
      observacoes: v.observacoes,
      campos_personalizados: cp.paraApi(),
    }
    // Escolha expressa do CMI: «por escolher» não se envia (o servidor pede a escolha).
    if (v.angariacao) corpo.angariacao = v.angariacao === 'sem' ? null : Number(v.angariacao)
    try {
      const r = transacao
        ? await transacoesApi.atualizar(transacao.id, { ...corpo, versao: transacao.versao })
        : await transacoesApi.criar({ ...corpo, proposta: ctx.proposta })
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['transacoes'] })
      qc.invalidateQueries({ queryKey: ['propostas'] })
      qc.setQueryData(['transacoes', String(r.id)], r)
      navegar(`/transacoes/${r.id}`, { replace: !transacao })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos as Record<string, string[]>)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  const leitura = (rotulo: string, valor: string | null) => (
    <CampoTexto rotulo={rotulo} value={valor ?? '—'} disabled readOnly />
  )
  const data = (c: keyof Valores, rotulo: string) => (
    <CampoTexto
      rotulo={rotulo}
      type="date"
      value={v[c] as string}
      onChange={(e) => mudar(c, e.target.value as never)}
      erro={erro(c)}
    />
  )
  const opcoesCmi = [
    ...cmis.map((c) => ({ valor: String(c.id), nome: c.descricao })),
    { valor: 'sem', nome: 'Sem CMI' },
  ]

  function desenharCampo(c: string): ReactNode {
    switch (c) {
      case 'proposta':
        return leitura('Proposta de origem', ctx.propostaReferencia)
      case 'imovel':
        return leitura('Imóvel', ctx.imovelDescricao)
      case 'entidade':
        return leitura('Comprador', ctx.compradorNome)
      case 'estado':
        return transacao ? leitura('Estado', ctx.estadoNome) : null
      case 'responsavel_imovel':
        return leitura('Responsável pelo imóvel', ctx.responsavelImovel)
      case 'responsavel_comprador':
        return leitura('Responsável pela entidade', ctx.responsavelComprador)
      case 'operacao':
        return (
          <CampoSelecao
            rotulo="Operação"
            required
            vazio="—"
            value={v.operacao}
            disabled={ctx.concluida}
            onChange={(e) => mudar('operacao', e.target.value)}
            opcoes={lista(o?.operacoes)}
            erro={erro('operacao')}
          />
        )
      case 'angariacao':
        return ctx.imovel === null ? (
          leitura('CMI', 'Sem CMI (imóvel não registado)')
        ) : (
          <CampoSelecao
            rotulo="CMI"
            required
            vazio="— escolha o CMI —"
            value={v.angariacao}
            disabled={ctx.concluida}
            onChange={(e) => {
              const cmi = cmis.find((x) => String(x.id) === e.target.value)
              setV((a) => ({
                ...a,
                angariacao: e.target.value,
                operacao: cmi?.operacao && !transacao ? String(cmi.operacao) : a.operacao,
              }))
            }}
            opcoes={opcoesCmi}
            erro={erro('angariacao')}
            ajuda={
              ctx.concluida
                ? 'Numa transação concluída o CMI não muda.'
                : 'Confirme o contrato de mediação deste negócio (servirá para a comissão).'
            }
          />
        )
      case 'valor':
        return (
          <CampoTexto
            rotulo="Valor acordado (€)"
            required
            inputMode="decimal"
            value={v.valor}
            onChange={(e) => mudar('valor', e.target.value)}
            erro={erro('valor')}
          />
        )
      case 'sinal':
        return (
          <>
            <CampoTexto
              rotulo="Sinal"
              inputMode="decimal"
              value={v.sinal_valor}
              onChange={(e) => mudar('sinal_valor', e.target.value)}
              erro={erro('sinal_valor')}
            />
            <CampoSelecao
              rotulo="O sinal é em"
              vazio="—"
              value={v.sinal_unidade}
              onChange={(e) => mudar('sinal_unidade', e.target.value)}
              opcoes={o?.unidades ?? []}
              erro={erro('sinal_unidade')}
            />
          </>
        )
      case 'responsavel':
        return (
          <CampoResponsavel
            modulo="transacoes"
            valor={v.responsavel}
            atual={transacao ? { id: transacao.responsavel, nome: transacao.responsavel_nome } : null}
            aoMudar={(x) => mudar('responsavel', x)}
            erro={erro('responsavel')}
          />
        )
      case 'data_cpcv_prevista':
        return arrendamento ? null : data('data_cpcv_prevista', 'Data prevista do CPCV')
      case 'data_cpcv':
        return arrendamento ? null : data('data_cpcv', 'Data do CPCV')
      case 'data_escritura_prevista':
        return data(
          'data_escritura_prevista',
          arrendamento ? 'Data prevista do contrato' : 'Data prevista da escritura',
        )
      case 'data_escritura':
        return data('data_escritura', arrendamento ? 'Data do contrato' : 'Data da escritura')
      case 'participantes':
        return (
          <Largo>
            <p className="ajuda">
              Compradores, proprietários e representantes deste negócio, com papéis e quotas. Ficam guardados na
              transação: alterações posteriores ao imóvel ou à proposta não os mudam.
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
        modulo="Transações"
        caminho="/transacoes"
        referencia={transacao?.referencia ?? 'Nova'}
        titulo={transacao ? 'Editar transação' : `Gerar transação (proposta ${ctx.propostaReferencia})`}
      />
      {!transacao && (
        <p className="aviso-duplicados">
          Dados preenchidos a partir da proposta aceite. Confirme o CMI, o valor, as datas e os participantes. A
          transação só é criada quando carregar em <strong>Guardar</strong>.
        </p>
      )}
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}
      {erro('proposta') && <p className="campo-erro">{erro('proposta')!.join(' ')}</p>}
      <BlocosConfiguraveis
        def={ECRA_TRANSACAO}
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
          onClick={() => navegar(transacao ? `/transacoes/${transacao.id}` : `/propostas/${ctx.proposta}`)}
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
