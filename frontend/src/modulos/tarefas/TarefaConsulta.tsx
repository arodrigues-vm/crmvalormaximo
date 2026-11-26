import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { Dado } from '../../componentes/campos'
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
  const { data: x, error, isLoading } = useQuery({ queryKey: ['tarefas', id], queryFn: () => tarefasApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['tarefas', 'opcoes'], queryFn: tarefasApi.opcoes, staleTime: 60_000 })
  const atualizar = (n: Tarefa) => {
    qc.setQueryData(['tarefas', id], n)
    qc.invalidateQueries({ queryKey: ['tarefas', 'lista'] })
  }
  const concluir = useMutation({
    mutationFn: (estado: number) => tarefasApi.atualizar(Number(id), { estado, versao: x?.versao }),
    onSuccess: atualizar,
  })
  const eliminar = useMutation({
    mutationFn: () => tarefasApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      navegar('/pos-venda', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Tarefa não encontrada ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar a tarefa.</p>
  const tf = x
  const concluida = opcoes.data?.estados.find((e) => e.categoria === 'concluida')
  const aberta = opcoes.data?.estados.find((e) => e.categoria === 'aberta')
  const estaConcluida = tf.estado_categoria === 'concluida'

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'titulo':
        return <Dado rotulo="Título">{tf.titulo}</Dado>
      case 'transacao':
        return (
          <Dado rotulo="Transação">
            <Link to={`/transacoes/${tf.transacao}`}>{tf.transacao_referencia}</Link>
          </Dado>
        )
      case 'cliente':
        return <Dado rotulo="Cliente">{tf.cliente_nome}</Dado>
      case 'imovel':
        return <Dado rotulo="Imóvel">{tf.imovel_descricao}</Dado>
      case 'estado':
        return (
          <Dado rotulo="Estado">
            {tf.estado_nome}
            {tf.concluida_em && <small className="ajuda"> · em {momentoPt(tf.concluida_em)}</small>}
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
        modulo="Pós-Venda"
        caminho="/pos-venda"
        referencia={x.referencia}
        titulo={x.titulo}
        etiqueta={
          x.estado_nome
            ? { texto: x.estado_nome, tipo: ETIQUETA_TAREFA[x.estado_categoria ?? ''] ?? 'neutra' }
            : undefined
        }
        acoes={
          <>
            {x.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setAEliminar(true)}>
                Eliminar
              </button>
            )}
            {x.acoes.editar && !estaConcluida && concluida && (
              <button
                className="botao-secundario"
                disabled={concluir.isPending}
                onClick={() => concluir.mutate(concluida.id)}
              >
                Marcar como concluída
              </button>
            )}
            {x.acoes.editar && estaConcluida && aberta && (
              <button
                className="botao-secundario"
                disabled={concluir.isPending}
                onClick={() => concluir.mutate(aberta.id)}
              >
                Reabrir
              </button>
            )}
            {x.acoes.editar && (
              <Link to={`/pos-venda/${x.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />
      {concluir.error && (
        <p className="erro" role="alert">
          {concluir.error instanceof ErroApi ? concluir.error.message : 'Não foi possível gravar.'}
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
