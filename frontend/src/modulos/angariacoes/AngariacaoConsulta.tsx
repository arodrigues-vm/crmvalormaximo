import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi, pedido } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { CampoAreaTexto, CampoSelecao, CampoTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, formatarEuros, formatarPercentagem, momentoPt } from '../../componentes/formatar'
import { LigacoesExternas } from '../../componentes/LigacoesExternas'
import { urlFotografia } from '../imoveis/api'
import { cmiApi, ETIQUETA_ESTADO, NOMES_CAMPOS_CMI, textoAlerta, type Angariacao } from './api'

function remuneracao(a: Angariacao): string | null {
  const v = a.valor_remuneracao
  if (!a.modalidade_remuneracao) return null
  const n = v === null ? 'valor não indicado' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 4 })
  switch (a.modalidade_remuneracao) {
    case 'percentagem':
      return v === null ? n : `${formatarPercentagem(v)} do valor do negócio`
    case 'valor_fixo':
      return v === null ? n : formatarEuros(v)
    case 'numero_rendas':
      return v === null ? n : `${n} renda${Number(v) === 1 ? '' : 's'}`
    case 'percentagem_base':
      return v === null ? n : `${formatarPercentagem(v)} sobre ${a.base_contratual}`
    default:
      return null
  }
}

/** Datas ISO aparecem como dd/mm/aaaa; outros valores (ex.: prazo) tal como estão. */
const valorCorrecao = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? dataPt(v) : v)

const proximoDia = (d: string) => {
  const x = new Date(`${d}T00:00:00`)
  x.setDate(x.getDate() + 1)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export function AngariacaoConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [dialogo, setDialogo] = useState<
    null | 'renovar' | 'corrigir' | 'concluir' | 'cancelar' | 'reabrir' | 'eliminar'
  >(null)
  const { data: a, error, isLoading } = useQuery({ queryKey: ['angariacoes', id], queryFn: () => cmiApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['angariacoes', 'opcoes'], queryFn: cmiApi.opcoes, staleTime: 60_000 })
  const tiposLigacao = useQuery({
    queryKey: ['listas', 'tipos_ligacao', 'opcoes'],
    queryFn: async () =>
      (await pedido<{ chave: string; valores: { id: number; nome: string; ativo: boolean }[] }[]>('/api/listas/'))
        .find((l) => l.chave === 'tipos_ligacao')
        ?.valores.filter((v) => v.ativo) ?? [],
    staleTime: 60_000,
  })

  const eliminar = useMutation({
    mutationFn: () => cmiApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['angariacoes'] })
      navegar('/angariacoes', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Angariação não encontrada ou sem acesso.</p>
  if (!a) return <p className="erro">Não foi possível carregar a angariação.</p>

  const atualizar = (nova: Angariacao) => {
    qc.setQueryData(['angariacoes', String(nova.id)], nova)
    qc.invalidateQueries({ queryKey: ['angariacoes', 'lista'] })
    qc.invalidateQueries({ queryKey: ['angariacoes', nova.id, 'historico'] })
    setDialogo(null)
  }
  // D-28: correção excecional e reabertura por quem pode editar o CMI (o servidor volta a verificar).
  const podeCorrigir = a.acoes.editar
  const emCurso = a.situacao === 'em_curso'

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Angariações"
        caminho="/angariacoes"
        referencia={a.referencia}
        titulo={`CMI ${a.numero_contrato ? `n.º ${a.numero_contrato}` : a.referencia} · ${a.imovel_referencia}`}
        etiqueta={{ texto: a.estado_nome, tipo: ETIQUETA_ESTADO[a.estado] }}
        acoes={
          <>
            {a.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setDialogo('eliminar')}>
                Eliminar
              </button>
            )}
            {a.acoes.editar && (
              <Link to={`/angariacoes/${a.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      {a.alerta && (
        <p className="alerta-cmi" role="status">
          <strong>{textoAlerta(a.alerta)}</strong> ({dataPt(a.data_fim_vigente)}). Aviso de {a.alerta.limiar} dias.
        </p>
      )}
      {a.estado === 'expirada' && (
        <p className="alerta-cmi" role="status">
          O contrato expirou em {dataPt(a.data_fim_vigente)}. Renove-o ou registe a situação (concluído/cancelado).
        </p>
      )}

      <div className="ficha-topo">
        <Link
          to={`/imoveis/${a.imovel}`}
          className="fotografia-imovel"
          aria-label={`Abrir imóvel ${a.imovel_referencia}`}
        >
          {a.imovel_fotografia ? (
            <img
              src={urlFotografia(a.imovel_fotografia.imovel, a.imovel_fotografia.versao)}
              alt={`Fotografia do imóvel ${a.imovel_referencia}`}
            />
          ) : (
            <div className="fotografia-vazia">Imóvel sem fotografia</div>
          )}
        </Link>
        <Bloco titulo="Contrato">
          <dl className="grelha-dados">
            <Dado rotulo="Imóvel">
              <Link to={`/imoveis/${a.imovel}`}>
                {a.imovel_referencia} · {a.imovel_descricao}
              </Link>
            </Dado>
            <Dado rotulo="N.º do contrato">{a.numero_contrato}</Dado>
            <Dado rotulo="Tipo (operação)">{a.nomes.operacao}</Dado>
            <Dado rotulo="Regime">{a.nomes.regime}</Dado>
            <Dado rotulo="Data de assinatura">{dataPt(a.data_assinatura)}</Dado>
            <Dado rotulo="Data de início (original)">{dataPt(a.data_inicio)}</Dado>
            <Dado rotulo="Prazo">{a.prazo_meses && `${a.prazo_meses} meses`}</Dado>
            <Dado rotulo="Fim do ciclo inicial">{dataPt(a.data_fim)}</Dado>
            <Dado rotulo="Fim em vigor">{dataPt(a.data_fim_vigente)}</Dado>
            <Dado rotulo="Situação">
              {a.nomes.situacao}
              {a.situacao_motivo && <small className="ajuda"> — {a.situacao_motivo}</small>}
            </Dado>
            <Dado rotulo="Responsável">{a.responsavel_nome}</Dado>
          </dl>
          <div className="acoes-bloco">
            {a.acoes.editar && a.assinado && emCurso && (
              <button className="botao-principal" onClick={() => setDialogo('renovar')}>
                Registar renovação
              </button>
            )}
            {a.acoes.editar && emCurso && (
              <>
                <button className="botao-secundario" onClick={() => setDialogo('concluir')}>
                  Concluir
                </button>
                <button className="botao-secundario" onClick={() => setDialogo('cancelar')}>
                  Cancelar / revogar
                </button>
              </>
            )}
            {podeCorrigir && !emCurso && (
              <button className="botao-secundario" onClick={() => setDialogo('reabrir')}>
                Reabrir
              </button>
            )}
            {podeCorrigir && a.assinado && (
              <button className="botao-secundario" onClick={() => setDialogo('corrigir')}>
                Correção excecional
              </button>
            )}
          </div>
        </Bloco>
      </div>

      <Bloco titulo="Ciclos de vigência">
        {!a.assinado ? (
          <p className="ajuda">O contrato ainda não foi assinado.</p>
        ) : (
          <ol className="ciclos">
            <li>
              <strong>Ciclo 1 — contrato inicial</strong>
              <span>
                {dataPt(a.data_inicio)} – {dataPt(a.data_fim)} ({a.prazo_meses} meses)
              </span>
            </li>
            {a.renovacoes.map((r) => (
              <li key={r.id}>
                <strong>Ciclo {r.ciclo} — renovação</strong>
                <span>
                  {dataPt(r.data_inicio)} – {dataPt(r.data_fim)} ({r.prazo_meses} meses) · {r.forma_nome}
                </span>
                {r.observacoes && <small className="ajuda">{r.observacoes}</small>}
              </li>
            ))}
          </ol>
        )}
      </Bloco>

      <Bloco titulo="Partes">
        {a.intervenientes_detalhe.length === 0 ? (
          <p className="ajuda">Sem partes registadas.</p>
        ) : (
          <ul className="lista-relacoes">
            {a.intervenientes_detalhe.map((i) => (
              <li key={i.entidade}>
                {i.papel_nome && <span className="relacao-tipo">{i.papel_nome}</span>}
                {i.acessivel ? (
                  <Link to={`/entidades/${i.entidade}`}>
                    {i.nome_completo} <small className="ajuda">{i.referencia}</small>
                  </Link>
                ) : (
                  <span className="vazio">Entidade a que não tem acesso</span>
                )}
                {i.quota && <small className="ajuda">{formatarPercentagem(i.quota)}</small>}
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Remuneração e pagamento">
        <dl className="grelha-dados">
          <Dado rotulo="Modalidade">{a.nomes.modalidade}</Dado>
          <Dado rotulo="Remuneração">{remuneracao(a)}</Dado>
          <Dado rotulo="Remuneração mínima">{formatarEuros(a.valor_minimo_remuneracao)}</Dado>
          <Dado rotulo="Taxa de IVA">{formatarPercentagem(a.taxa_iva)}</Dado>
          <Dado rotulo="Valores">
            {a.remuneracao_inclui_iva === null ? null : a.remuneracao_inclui_iva ? 'Com IVA incluído' : 'Acresce IVA'}
          </Dado>
          <Dado rotulo="Condições e momentos de pagamento" largo>
            {a.condicoes_pagamento && <span className="texto-livre">{a.condicoes_pagamento}</span>}
          </Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Documentos e ligações">
        <LigacoesExternas
          base={`/api/angariacoes/${a.id}/ligacoes/`}
          podeEditar={a.acoes.editar}
          tipos={tiposLigacao.data ?? []}
        />
      </Bloco>

      {a.correcoes.length > 0 && (
        <Bloco titulo="Correções excecionais" abertoInicial={false} resumo={`${a.correcoes.length}`}>
          <ul className="historico">
            {a.correcoes.map((c, i) => (
              <li key={i}>
                <div className="historico-cabecalho">
                  <strong>{NOMES_CAMPOS_CMI[c.campo] ?? c.campo}</strong>: <s>{valorCorrecao(c.valor_anterior)}</s> →{' '}
                  {valorCorrecao(c.valor_novo)}
                </div>
                <small>
                  {momentoPt(c.criado_em)} · {c.criado_por} · Motivo: {c.motivo} · Evidência: {c.evidencia}
                </small>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      <Bloco titulo="Observações" abertoInicial={!!a.observacoes}>
        <p className="texto-livre">{a.observacoes || <span className="vazio">—</span>}</p>
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <HistoricoRegisto
            chave={['angariacoes', a.id, 'historico']}
            obter={() => cmiApi.historico(a.id)}
            nomesCampos={NOMES_CAMPOS_CMI}
          />
        )}
      </Bloco>

      {dialogo === 'renovar' && (
        <DialogoRenovar
          a={a}
          formas={opcoes.data?.formas_renovacao ?? []}
          aoGravar={atualizar}
          aoFechar={() => setDialogo(null)}
        />
      )}
      {dialogo === 'corrigir' && <DialogoCorrigir a={a} aoGravar={atualizar} aoFechar={() => setDialogo(null)} />}
      {(dialogo === 'concluir' || dialogo === 'cancelar' || dialogo === 'reabrir') && (
        <DialogoSituacao
          a={a}
          nova={dialogo === 'concluir' ? 'concluida' : dialogo === 'cancelar' ? 'cancelada' : 'em_curso'}
          aoGravar={atualizar}
          aoFechar={() => setDialogo(null)}
        />
      )}
      <Dialogo
        titulo="Eliminar angariação"
        aberto={dialogo === 'eliminar'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>
          A angariação <strong>{a.referencia}</strong> será enviada para a lixeira. Se o contrato terminou ou foi
          revogado, prefira <strong>Concluir</strong> ou <strong>Cancelar / revogar</strong>.
        </p>
      </Dialogo>
    </div>
  )
}

function useAcao(acao: () => Promise<Angariacao>, aoGravar: (a: Angariacao) => void) {
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const m = useMutation({
    mutationFn: acao,
    onSuccess: aoGravar,
    onError: (e) =>
      setErros(
        e instanceof ErroApi
          ? Object.keys(e.campos).length
            ? e.campos
            : { detail: [e.message] }
          : { detail: ['Falha ao gravar.'] },
      ),
  })
  return { m, erros }
}

function Erros({ erros }: { erros: Record<string, string[]> }) {
  const texto = Object.values(erros).flat().join(' ')
  return texto ? (
    <p className="erro" role="alert">
      {texto}
    </p>
  ) : null
}

function DialogoBase({
  titulo,
  aoFechar,
  aoConfirmar,
  pendente,
  confirmar,
  children,
}: {
  titulo: string
  aoFechar: () => void
  aoConfirmar: () => void
  pendente: boolean
  confirmar: string
  children: ReactNode
}) {
  return (
    <Dialogo
      titulo={titulo}
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="botao-principal" disabled={pendente} onClick={aoConfirmar}>
            {confirmar}
          </button>
        </>
      }
    >
      <div className="formulario-dialogo">{children}</div>
    </Dialogo>
  )
}

function DialogoRenovar({
  a,
  formas,
  aoGravar,
  aoFechar,
}: {
  a: Angariacao
  formas: { valor: string; nome: string }[]
  aoGravar: (a: Angariacao) => void
  aoFechar: () => void
}) {
  const [forma, setForma] = useState('')
  const [inicio, setInicio] = useState(a.data_fim_vigente ? proximoDia(a.data_fim_vigente) : '')
  const [prazo, setPrazo] = useState(String(a.prazo_meses ?? ''))
  const [observacoes, setObservacoes] = useState('')
  const { m, erros } = useAcao(
    () => cmiApi.renovar(a.id, { forma, data_inicio: inicio, prazo_meses: Number(prazo), observacoes }),
    aoGravar,
  )
  return (
    <DialogoBase
      titulo="Registar renovação"
      aoFechar={aoFechar}
      aoConfirmar={() => m.mutate()}
      pendente={m.isPending}
      confirmar="Registar renovação"
    >
      <p className="ajuda">
        A renovação cria um novo ciclo com data de início própria. A data de início original do contrato e os ciclos
        anteriores mantêm-se.
      </p>
      <CampoSelecao
        rotulo="Forma"
        vazio="—"
        value={forma}
        onChange={(e) => setForma(e.target.value)}
        opcoes={formas}
        erro={erros.forma}
      />
      <CampoTexto
        rotulo="Início da renovação"
        type="date"
        value={inicio}
        onChange={(e) => setInicio(e.target.value)}
        erro={erros.data_inicio}
      />
      <CampoTexto
        rotulo="Prazo (meses)"
        inputMode="numeric"
        value={prazo}
        onChange={(e) => setPrazo(e.target.value)}
        erro={erros.prazo_meses}
      />
      <CampoTexto rotulo="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      <Erros erros={{ detail: erros.detail ?? [] }} />
    </DialogoBase>
  )
}

function DialogoCorrigir({
  a,
  aoGravar,
  aoFechar,
}: {
  a: Angariacao
  aoGravar: (a: Angariacao) => void
  aoFechar: () => void
}) {
  const [campo, setCampo] = useState('data_inicio')
  const atual = (c: string) => String((a as unknown as Record<string, unknown>)[c] ?? '')
  const [valor, setValor] = useState(atual('data_inicio'))
  const [motivo, setMotivo] = useState('')
  const [evidencia, setEvidencia] = useState('')
  const { m, erros } = useAcao(() => cmiApi.corrigir(a.id, { campo, valor, motivo, evidencia }), aoGravar)
  return (
    <DialogoBase
      titulo="Correção excecional"
      aoFechar={aoFechar}
      aoConfirmar={() => m.mutate()}
      pendente={m.isPending}
      confirmar="Corrigir"
    >
      <p className="aviso-duplicados">
        Use apenas para corrigir um <strong>erro de registo</strong> (o contrato não mudou). Fica registado com o
        motivo, a evidência e o seu nome.
      </p>
      <CampoSelecao
        rotulo="Dado a corrigir"
        value={campo}
        onChange={(e) => {
          setCampo(e.target.value)
          setValor(atual(e.target.value))
        }}
        opcoes={[
          { valor: 'data_inicio', nome: 'Data de início' },
          { valor: 'data_assinatura', nome: 'Data de assinatura' },
          { valor: 'prazo_meses', nome: 'Prazo (meses)' },
        ]}
      />
      <CampoTexto
        rotulo="Valor correto"
        type={campo === 'prazo_meses' ? 'text' : 'date'}
        inputMode={campo === 'prazo_meses' ? 'numeric' : undefined}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        erro={erros.valor}
      />
      <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} erro={erros.motivo} />
      <CampoTexto
        rotulo="Evidência"
        value={evidencia}
        onChange={(e) => setEvidencia(e.target.value)}
        erro={erros.evidencia}
        ajuda="Descreva ou cole a ligação para o documento que comprova o erro (ex.: o CMI digitalizado)."
      />
      <Erros erros={{ detail: erros.detail ?? [] }} />
    </DialogoBase>
  )
}

function DialogoSituacao({
  a,
  nova,
  aoGravar,
  aoFechar,
}: {
  a: Angariacao
  nova: 'concluida' | 'cancelada' | 'em_curso'
  aoGravar: (a: Angariacao) => void
  aoFechar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const { m, erros } = useAcao(() => cmiApi.situacao(a.id, { situacao: nova, motivo }), aoGravar)
  const titulos = {
    concluida: 'Concluir angariação',
    cancelada: 'Cancelar / revogar angariação',
    em_curso: 'Reabrir angariação',
  }
  const ajudas = {
    concluida: 'Use quando o negócio foi realizado ao abrigo deste contrato.',
    cancelada: 'Use quando o contrato foi revogado ou terminado antes do fim.',
    em_curso: 'O contrato volta a ficar em curso.',
  }
  return (
    <DialogoBase
      titulo={titulos[nova]}
      aoFechar={aoFechar}
      aoConfirmar={() => m.mutate()}
      pendente={m.isPending}
      confirmar="Confirmar"
    >
      <p className="ajuda">{ajudas[nova]}</p>
      <CampoTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} erro={erros.motivo} />
      <Erros erros={{ detail: [...(erros.detail ?? []), ...(erros.situacao ?? [])] }} />
    </DialogoBase>
  )
}
