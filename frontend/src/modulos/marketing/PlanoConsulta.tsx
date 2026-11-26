import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, momentoPt } from '../../componentes/formatar'
import { comoRegistoCp } from '../../componentes/personalizados'
import { ETIQUETA_TAREFA, tarefasApi, type TarefaResumo } from '../tarefas/api'
import { NOMES_CAMPOS_PLANO, NOMES_COR, planosApi, type Plano } from './api'
import { ECRA_PLANO } from './disposicao'
import { Semanas } from './Semanas'

const mensagem = (e: unknown) =>
  e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : e ? 'Não foi possível gravar.' : null

export function PlanoConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const { utilizador } = useSessao()
  const [dialogo, setDialogo] = useState<null | 'pedir' | 'recusar' | 'eliminar' | { reabrir: TarefaResumo }>(null)
  const [motivo, setMotivo] = useState('')
  const {
    data: x,
    error,
    isLoading,
  } = useQuery({ queryKey: ['planos-marketing', id], queryFn: () => planosApi.obter(id) })
  const opcoesTarefa = useQuery({ queryKey: ['tarefas', 'opcoes'], queryFn: tarefasApi.opcoes, staleTime: 60_000 })
  const atualizar = (n: Plano) => {
    qc.setQueryData(['planos-marketing', id], n)
    qc.invalidateQueries({ queryKey: ['planos-marketing', 'lista'] })
    qc.invalidateQueries({ queryKey: ['tarefas'] })
    setDialogo(null)
    setMotivo('')
  }
  const incluir = useMutation({
    mutationFn: ({ t, v }: { t: number; v: boolean }) => planosApi.incluir(Number(id), t, v),
    onSuccess: atualizar,
  })
  const estado = useMutation({
    mutationFn: ({ t, cat, motivo = '' }: { t: number; cat: string; motivo?: string }) =>
      tarefasApi.mudarEstado(t, opcoesTarefa.data!.estados.find((e) => e.categoria === cat)!.id, motivo),
    onSuccess: async () => atualizar(await planosApi.obter(id)),
  })
  const pedir = useMutation({ mutationFn: () => planosApi.pedirRecalculo(Number(id), motivo), onSuccess: atualizar })
  const decidir = useMutation({
    mutationFn: (aprovar: boolean) => planosApi.decidirRecalculo(Number(id), aprovar, motivo),
    onSuccess: atualizar,
  })
  const eliminar = useMutation({
    mutationFn: () => planosApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planos-marketing'] })
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      navegar('/marketing-imoveis', { replace: true })
    },
  })
  const previa = useQuery({
    queryKey: ['planos-marketing', id, 'previa-recalculo'],
    queryFn: () => planosApi.previaRecalculo(Number(id)),
    enabled: dialogo === 'pedir',
    gcTime: 0,
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Plano não encontrado ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar o plano.</p>
  const p = x
  const erroAcao = mensagem(incluir.error ?? estado.error)
  const dataMudou = !!p.angariacao_data_inicio && p.angariacao_data_inicio !== p.data_base
  const pendente = p.pedido_pendente

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'imovel':
        return (
          <Dado rotulo="Imóvel">
            <Link to={`/imoveis/${p.imovel}`}>{p.imovel_descricao}</Link>
          </Dado>
        )
      case 'angariacao':
        return (
          <Dado rotulo="CMI">
            <Link to={`/angariacoes/${p.angariacao}`}>{p.angariacao_referencia}</Link>
          </Dado>
        )
      case 'ciclo':
        return (
          <Dado rotulo="Ciclo">
            {p.ciclo === 1 ? 'Plano inicial' : `${p.ciclo}.º ciclo (após renovação)`}
            {!p.ativo && <span className="etiqueta etiqueta-neutra"> substituído</span>}
            {p.plano_anterior && (
              <small className="ajuda">
                {' '}
                · anterior: <Link to={`/marketing-imoveis/${p.plano_anterior}`}>{p.plano_anterior_referencia}</Link>
              </small>
            )}
            {p.ciclos_seguintes.map((c) => (
              <small key={c.id} className="ajuda">
                {' '}
                · seguinte: <Link to={`/marketing-imoveis/${c.id}`}>{c.referencia}</Link>
              </small>
            ))}
          </Dado>
        )
      case 'data_base':
        return (
          <Dado rotulo={p.ciclo === 1 ? 'Data-base (início do CMI)' : 'Data-base (início da renovação)'}>
            {dataPt(p.data_base)}
          </Dado>
        )
      case 'responsavel':
        return <Dado rotulo="Responsável">{p.responsavel_nome}</Dado>
      case 'progresso':
        return (
          <Dado rotulo="Progresso">
            {p.indicadores.concluidas} de {p.indicadores.incluidas} concluídas ({NOMES_COR[p.indicadores.cor]})
          </Dado>
        )
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {p.observacoes && <span className="texto-livre">{p.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Plano de Marketing de Imóveis"
        caminho="/marketing-imoveis"
        referencia={p.referencia}
        titulo={p.imovel_descricao}
        acoes={
          <>
            {p.acoes.eliminar && p.indicadores.concluidas === 0 && (
              <button className="botao-secundario" onClick={() => setDialogo('eliminar')}>
                Eliminar
              </button>
            )}
            {p.acoes.editar && (
              <Link to={`/marketing-imoveis/${p.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <Semanas ind={p.indicadores} />

      {(dataMudou || pendente) && (
        <div className="aviso-duplicados">
          {pendente ? (
            <>
              <p>
                Recálculo pedido por <strong>{pendente.pedido_por_nome}</strong> em {momentoPt(pendente.pedido_em)}:
                data-base {dataPt(pendente.data_base_anterior)} → <strong>{dataPt(pendente.data_base_nova)}</strong>.
                Motivo: {pendente.motivo}
              </p>
              {p.acoes.aprovar && pendente.pedido_por !== utilizador?.id ? (
                <div className="acoes-formulario">
                  <button className="botao-secundario" onClick={() => setDialogo('recusar')}>
                    Recusar
                  </button>
                  <button className="botao-principal" disabled={decidir.isPending} onClick={() => decidir.mutate(true)}>
                    Aprovar o recálculo
                  </button>
                </div>
              ) : (
                <p className="ajuda">À espera da aprovação de um Responsável de Equipa ou do Administrador.</p>
              )}
              {decidir.error && !dialogo && (
                <p className="erro" role="alert">
                  {mensagem(decidir.error)}
                </p>
              )}
            </>
          ) : (
            <>
              <p>
                A data de início do {p.ciclo === 1 ? 'CMI' : 'ciclo (renovação)'} ({dataPt(p.angariacao_data_inicio!)})
                é diferente da data-base do plano ({dataPt(p.data_base)}). Os prazos das tarefas por fazer podem ser
                recalculados (as concluídas não mudam).
              </p>
              {p.acoes.editar && (
                <button className="botao-secundario" onClick={() => setDialogo('pedir')}>
                  Pedir recálculo dos prazos
                </button>
              )}
            </>
          )}
        </div>
      )}

      {erroAcao && (
        <p className="erro" role="alert">
          {erroAcao}
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_PLANO}
        modo="ver"
        registo={comoRegistoCp(p)}
        campo={desenharCampo}
        abertoInicial={(b) => b.chave !== 'observacoes' || !!p.observacoes}
      />

      {p.indicadores.semanas.map((s) => (
        <Bloco
          key={s.semana}
          titulo={`${s.semana}ª semana · ${s.concluidas}/${s.incluidas} concluídas`}
          abertoInicial={s.cor !== 'verde'}
        >
          <ul className="ocorrencias-plano">
            {p.ocorrencias
              .filter((t) => t.mk_semana === s.semana)
              .map((t) => {
                const concluida = t.estado_categoria === 'concluida'
                // Fechadas: concluída, cancelada ou encerrada por um novo ciclo («Não executada — Plano substituído»).
                const fechada = ['concluida', 'cancelada', 'substituida'].includes(t.estado_categoria ?? '')
                return (
                  <li key={t.id} className={t.incluida ? '' : 'excluida'}>
                    <label className="ocorrencia-incluir" title="Incluir no plano">
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${t.mk_numero}. ${t.titulo}`}
                        checked={t.incluida}
                        disabled={!p.acoes.editar || incluir.isPending || (concluida && t.incluida)}
                        onChange={(e) => incluir.mutate({ t: t.id, v: e.target.checked })}
                      />
                    </label>
                    <span className="ocorrencia-numero">{t.mk_numero}.</span>
                    <Link to={`/tarefas/${t.id}`} className="ocorrencia-titulo">
                      {t.titulo}
                    </Link>
                    <span className="ajuda">
                      {t.prazo ? dataPt(t.prazo) : '—'} · {t.responsavel_nome}
                    </span>
                    {t.incluida && t.estado_nome && (
                      <span className={`etiqueta etiqueta-${ETIQUETA_TAREFA[t.estado_categoria ?? ''] ?? 'neutra'}`}>
                        {t.estado_nome}
                      </span>
                    )}
                    {t.incluida && t.atrasada && <span className="etiqueta etiqueta-perigo">Atrasada</span>}
                    {t.incluida && p.acoes.editar && !fechada && (
                      <button
                        className="ligacao-botao"
                        disabled={estado.isPending}
                        onClick={() => estado.mutate({ t: t.id, cat: 'concluida' })}
                      >
                        Concluir
                      </button>
                    )}
                    {t.incluida && p.acoes.editar && fechada && (
                      <button className="ligacao-botao" onClick={() => setDialogo({ reabrir: t })}>
                        Reabrir
                      </button>
                    )}
                  </li>
                )
              })}
          </ul>
        </Bloco>
      ))}

      {p.pedidos.length > 0 && (
        <Bloco titulo="Pedidos de recálculo" abertoInicial={false}>
          <ul className="historico">
            {p.pedidos.map((r) => (
              <li key={r.id}>
                <div className="historico-cabecalho">
                  {dataPt(r.data_base_anterior)} → {dataPt(r.data_base_nova)} ·{' '}
                  <span className="etiqueta etiqueta-neutra">{r.estado}</span>
                </div>
                <small>
                  Pedido por {r.pedido_por_nome} em {momentoPt(r.pedido_em)}: {r.motivo}
                  {r.decidido_por_nome &&
                    ` · decidido por ${r.decidido_por_nome} em ${momentoPt(r.decidido_em!)}${r.motivo_decisao ? `: ${r.motivo_decisao}` : ''}`}
                </small>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['planos-marketing', p.id, 'historico']}
              obter={() => planosApi.historico(p.id)}
              nomesCampos={NOMES_CAMPOS_PLANO}
            />
            <p className="ajuda">Criado em {momentoPt(p.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Pedir recálculo dos prazos"
        aberto={dialogo === 'pedir'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button className="botao-principal" disabled={pedir.isPending} onClick={() => pedir.mutate()}>
              Enviar pedido
            </button>
          </>
        }
      >
        {previa.data && (
          <>
            <p className="ajuda">
              Data-base {dataPt(previa.data.data_base_atual)} →{' '}
              <strong>{dataPt(previa.data.data_base_nova ?? '')}</strong>. Mudam {previa.data.ocorrencias.length}{' '}
              tarefas por fazer; as concluídas ficam como estão. Depois de enviado, o pedido tem de ser aprovado por
              outra pessoa (Responsável de Equipa ou Administrador).
            </p>
            <ul className="previa-recalculo">
              {previa.data.ocorrencias.slice(0, 50).map((o) => (
                <li key={o.tarefa}>
                  {o.numero}. {o.titulo}: {o.prazo_atual ? dataPt(o.prazo_atual) : '—'} → {dataPt(o.prazo_novo)}
                </li>
              ))}
            </ul>
          </>
        )}
        <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {pedir.error && (
          <p className="erro" role="alert">
            {mensagem(pedir.error)}
          </p>
        )}
      </Dialogo>

      <Dialogo
        titulo="Recusar o recálculo"
        aberto={dialogo === 'recusar'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button className="botao-principal" disabled={decidir.isPending} onClick={() => decidir.mutate(false)}>
              Recusar
            </button>
          </>
        }
      >
        <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {decidir.error && (
          <p className="erro" role="alert">
            {mensagem(decidir.error)}
          </p>
        )}
      </Dialogo>

      <Dialogo
        titulo="Reabrir tarefa"
        aberto={typeof dialogo === 'object' && dialogo !== null}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button
              className="botao-principal"
              disabled={estado.isPending}
              onClick={() =>
                typeof dialogo === 'object' &&
                dialogo &&
                estado.mutate({ t: dialogo.reabrir.id, cat: 'aberta', motivo })
              }
            >
              Reabrir
            </button>
          </>
        }
      >
        <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {estado.error && (
          <p className="erro" role="alert">
            {mensagem(estado.error)}
          </p>
        )}
      </Dialogo>

      <Dialogo
        titulo="Eliminar plano"
        aberto={dialogo === 'eliminar'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>O plano e as suas tarefas vão para a lixeira. Só é possível enquanto nenhuma tarefa estiver concluída.</p>
        {eliminar.error && (
          <p className="erro" role="alert">
            {mensagem(eliminar.error)}
          </p>
        )}
      </Dialogo>
    </div>
  )
}
