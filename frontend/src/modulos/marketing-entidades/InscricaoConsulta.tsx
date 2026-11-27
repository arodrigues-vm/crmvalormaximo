import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, momentoPt } from '../../componentes/formatar'
import { comoRegistoCp } from '../../componentes/personalizados'
import { caminhoTarefa, ETIQUETA_TAREFA, tarefasApi } from '../tarefas/api'
import { inscricoesApi, NOMES_CAMPOS_INSCRICAO } from './api'
import { ECRA_INSCRICAO } from './disposicao'

export function InscricaoConsulta() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [aTerminar, setATerminar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const {
    data: x,
    error,
    isLoading,
  } = useQuery({ queryKey: ['inscricoes-marketing', id], queryFn: () => inscricoesApi.obter(id) })
  const tarefas = useQuery({
    queryKey: ['tarefas', 'lista', { inscricao: id, vista: 'todas' }],
    queryFn: () => tarefasApi.listar({ inscricao: id, vista: 'todas' }),
  })
  const terminar = useMutation({
    mutationFn: () => inscricoesApi.terminar(Number(id), motivo),
    onSuccess: (n) => {
      qc.setQueryData(['inscricoes-marketing', id], n)
      qc.invalidateQueries({ queryKey: ['inscricoes-marketing', 'lista'] })
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      setATerminar(false)
    },
  })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Registo não encontrado ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar.</p>
  const i = x
  function campo(k: string): ReactNode {
    switch (k) {
      case 'entidade':
        return (
          <Dado rotulo="Entidade">
            <Link to={`/entidades/${i.entidade}`}>{i.entidade_nome}</Link>
          </Dado>
        )
      case 'plano':
        return <Dado rotulo="Plano">{i.plano_nome}</Dado>
      case 'fundamento':
        return <Dado rotulo="Fundamento (RGPD)">{i.plano_fundamento}</Dado>
      case 'inicio':
        return <Dado rotulo="Início">{dataPt(i.inicio)}</Dado>
      case 'origem':
        return <Dado rotulo="Como começou">{i.origem_nome}</Dado>
      case 'estado':
        return (
          <Dado rotulo="Estado">
            {i.estado === 'ativa' ? 'Ativa' : `Terminada em ${momentoPt(i.terminada_em!)}`}
            {i.motivo_fim && <small className="ajuda"> · {i.motivo_fim}</small>}
          </Dado>
        )
      case 'responsavel':
        return <Dado rotulo="Responsável">{i.responsavel_nome}</Dado>
      case 'progresso':
        return (
          <Dado rotulo="Progresso">
            {i.progresso.concluidas} concluídas · {i.progresso.por_fazer} por fazer
          </Dado>
        )
    }
    return null
  }
  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Marketing de Entidades"
        caminho="/marketing-entidades"
        referencia={i.referencia}
        titulo={`${i.entidade_nome} · ${i.plano_nome}`}
        etiqueta={{
          texto: i.estado === 'ativa' ? 'Ativa' : 'Terminada',
          tipo: i.estado === 'ativa' ? 'aviso' : 'neutra',
        }}
        acoes={
          i.acoes.editar && i.estado === 'ativa' ? (
            <button className="botao-secundario" onClick={() => setATerminar(true)}>
              Terminar
            </button>
          ) : undefined
        }
      />
      <BlocosConfiguraveis def={ECRA_INSCRICAO} modo="ver" registo={comoRegistoCp(i)} campo={campo} />
      <Bloco titulo="Tarefas">
        <ul className="lista-relacoes">
          {(tarefas.data?.results ?? []).map((t) => (
            <li key={t.id}>
              <Link to={caminhoTarefa(t)}>{t.titulo}</Link>
              <span className="relacao-tipo">
                {t.prazo ? dataPt(t.prazo) : 'Sem prazo'} · {t.responsavel_nome}
              </span>
              {t.estado_nome && (
                <span className={`etiqueta etiqueta-${ETIQUETA_TAREFA[t.estado_categoria ?? ''] ?? 'neutra'}`}>
                  {t.estado_nome}
                </span>
              )}
              {t.atrasada && <span className="etiqueta etiqueta-perigo">Atrasada</span>}
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <HistoricoRegisto
            chave={['inscricoes-marketing', i.id, 'historico']}
            obter={() => inscricoesApi.historico(i.id)}
            nomesCampos={NOMES_CAMPOS_INSCRICAO}
          />
        )}
      </Bloco>
      <Dialogo
        titulo="Terminar o plano para esta entidade"
        aberto={aTerminar}
        aoFechar={() => setATerminar(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setATerminar(false)}>
              Voltar
            </button>
            <button className="botao-principal" disabled={terminar.isPending} onClick={() => terminar.mutate()}>
              Terminar
            </button>
          </>
        }
      >
        <p className="ajuda">As tarefas por fazer ficam canceladas; as concluídas ficam no histórico.</p>
        <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {terminar.error instanceof ErroApi && (
          <p className="erro" role="alert">
            {Object.values(terminar.error.campos).flat().join(' ') || terminar.error.message}
          </p>
        )}
      </Dialogo>
    </div>
  )
}
