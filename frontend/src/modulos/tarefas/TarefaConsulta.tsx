import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { comoRegistoCp } from '../../componentes/personalizados'
import { ETIQUETA_TAREFA, NOMES_CAMPOS_TAREFA, tarefasApi, type Tarefa } from './api'
import { ECRA_TAREFA } from './disposicao'

export function TarefaConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [aEliminar, setAEliminar] = useState(false)
  // Estado a confirmar com motivo (reabrir ou cancelar).
  const [comMotivo, setComMotivo] = useState<{ id: number; nome: string } | null>(null)
  const [motivo, setMotivo] = useState('')
  const { data: x, error, isLoading } = useQuery({ queryKey: ['tarefas', id], queryFn: () => tarefasApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['tarefas', 'opcoes'], queryFn: tarefasApi.opcoes, staleTime: 60_000 })
  const atualizar = (n: Tarefa) => {
    qc.setQueryData(['tarefas', id], n)
    qc.invalidateQueries({ queryKey: ['tarefas', 'lista'] })
  }
  const concluir = useMutation({
    mutationFn: ({ estado, motivo = '' }: { estado: number; motivo?: string }) =>
      tarefasApi.mudarEstado(Number(id), estado, motivo),
    onSuccess: (n) => {
      atualizar(n)
      qc.invalidateQueries({ queryKey: ['agenda'] })
      setComMotivo(null)
      setMotivo('')
    },
  })
  const eliminar = useMutation({
    mutationFn: () => tarefasApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      navegar(x?.pos_venda ? '/pos-venda' : '/tarefas', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Tarefa não encontrada ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar a tarefa.</p>
  const tf = x
  const base = tf.pos_venda ? '/pos-venda' : '/tarefas'
  const concluida = opcoes.data?.estados.find((e) => e.categoria === 'concluida')
  const aberta = opcoes.data?.estados.find((e) => e.categoria === 'aberta')
  const cancelada = opcoes.data?.estados.find((e) => e.categoria === 'cancelada')
  const fechada = ['concluida', 'cancelada'].includes(tf.estado_categoria ?? '')
  const erroEstado =
    concluir.error instanceof ErroApi
      ? Object.values(concluir.error.campos).flat().join(' ') || concluir.error.message
      : concluir.error
        ? 'Não foi possível gravar.'
        : null

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'titulo':
        return <Dado rotulo="Título">{tf.titulo}</Dado>
      case 'transacao':
        return tf.pos_venda ? (
          <Dado rotulo="Transação">
            <Link to={`/transacoes/${tf.transacao}`}>{tf.transacao_referencia}</Link>
          </Dado>
        ) : null
      case 'plano':
        return tf.marketing ? (
          <Dado rotulo="Plano de marketing">
            <Link to={`/marketing-imoveis/${tf.plano}`}>{tf.plano_referencia}</Link>
            <small className="ajuda">
              {' '}
              · n.º {tf.mk_numero} · {tf.mk_semana}ª semana{tf.incluida ? '' : ' · não incluída'}
            </small>
          </Dado>
        ) : null
      case 'origem':
        if (tf.pos_venda || tf.marketing) return null
        return (
          <Dado rotulo="Ligada a">
            {tf.origem &&
              (tf.origem.caminho ? (
                <Link to={tf.origem.caminho}>{tf.origem.titulo}</Link>
              ) : (
                <span className="vazio">{tf.origem.titulo}</span>
              ))}
            {tf.origem && <small className="ajuda"> · {tf.origem.modulo_nome}</small>}
          </Dado>
        )
      case 'cliente':
        return tf.pos_venda ? <Dado rotulo="Cliente">{tf.cliente_nome}</Dado> : null
      case 'imovel':
        return tf.pos_venda ? <Dado rotulo="Imóvel">{tf.imovel_descricao}</Dado> : null
      case 'estado':
        return (
          <Dado rotulo="Estado">
            {tf.estado_nome}
            {tf.concluida_em && <small className="ajuda"> · em {momentoPt(tf.concluida_em)}</small>}
            {tf.motivo_estado && <small className="ajuda"> · {tf.motivo_estado}</small>}
          </Dado>
        )
      case 'prioridade':
        return <Dado rotulo="Prioridade">{tf.prioridade_nome}</Dado>
      case 'prazo':
        return (
          <Dado rotulo="Prazo">
            {tf.prazo && dataPt(tf.prazo)}
            {tf.atrasada && <span className="etiqueta etiqueta-perigo"> Atrasada</span>}
          </Dado>
        )
      case 'responsavel':
        return <Dado rotulo="Responsável">{tf.responsavel_nome}</Dado>
      case 'descricao':
        return (
          <Dado rotulo="Descrição" largo>
            {tf.descricao && <span className="texto-livre">{tf.descricao}</span>}
          </Dado>
        )
      case 'categoria':
        return <Dado rotulo="Categoria">{opcoes.data?.categorias.find((c) => c.id === tf.categoria)?.nome}</Dado>
      case 'modelo':
        return <Dado rotulo="Modelo de origem">{tf.modelo_nome}</Dado>
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo={tf.pos_venda ? 'Pós-Venda' : 'Tarefas'}
        caminho={base}
        referencia={x.referencia}
        titulo={x.titulo}
        etiqueta={
          x.estado_nome
            ? { texto: x.estado_nome, tipo: ETIQUETA_TAREFA[x.estado_categoria ?? ''] ?? 'neutra' }
            : undefined
        }
        acoes={
          <>
            {x.acoes.eliminar && !tf.marketing && (
              <button className="botao-secundario" onClick={() => setAEliminar(true)}>
                Eliminar
              </button>
            )}
            {x.acoes.editar && !fechada && cancelada && (
              <button className="botao-secundario" onClick={() => setComMotivo(cancelada)}>
                Cancelar tarefa
              </button>
            )}
            {x.acoes.editar && !fechada && concluida && (
              <button
                className="botao-secundario"
                disabled={concluir.isPending}
                onClick={() => concluir.mutate({ estado: concluida.id })}
              >
                Marcar como concluída
              </button>
            )}
            {x.acoes.editar && fechada && aberta && (
              <button className="botao-secundario" onClick={() => setComMotivo(aberta)}>
                Reabrir
              </button>
            )}
            {x.acoes.editar && (
              <Link to={`${base}/${x.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />
      {erroEstado && !comMotivo && (
        <p className="erro" role="alert">
          {erroEstado}
        </p>
      )}

      <BlocosConfiguraveis def={ECRA_TAREFA} modo="ver" registo={comoRegistoCp(x)} campo={desenharCampo} />

      <Bloco titulo="Contactos e notas">
        <Interacoes
          base={`/api/tarefas/${x.id}/interacoes/`}
          podeEditar={x.acoes.editar}
          tipos={opcoes.data?.tipos_interacao ?? []}
        />
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['tarefas', x.id, 'historico']}
              obter={() => tarefasApi.historico(x.id)}
              nomesCampos={NOMES_CAMPOS_TAREFA}
            />
            <p className="ajuda">Criada em {momentoPt(x.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo={comMotivo?.id === aberta?.id ? 'Reabrir tarefa' : 'Cancelar tarefa'}
        aberto={!!comMotivo}
        aoFechar={() => setComMotivo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setComMotivo(null)}>
              Voltar
            </button>
            <button
              className="botao-principal"
              disabled={concluir.isPending}
              onClick={() => comMotivo && concluir.mutate({ estado: comMotivo.id, motivo })}
            >
              {comMotivo?.id === aberta?.id ? 'Reabrir' : 'Cancelar tarefa'}
            </button>
          </>
        }
      >
        <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {erroEstado && (
          <p className="erro" role="alert">
            {erroEstado}
          </p>
        )}
      </Dialogo>

      <Dialogo
        titulo="Eliminar tarefa"
        aberto={aEliminar}
        aoFechar={() => setAEliminar(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setAEliminar(false)}>
              Cancelar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>Se a tarefa deixou de fazer sentido, pode também mudar o estado para «Cancelada».</p>
        {eliminar.error && (
          <p className="erro" role="alert">
            {eliminar.error instanceof ErroApi ? eliminar.error.message : 'Não foi possível eliminar.'}
          </p>
        )}
      </Dialogo>
    </div>
  )
}
