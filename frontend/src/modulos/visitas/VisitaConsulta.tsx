import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, momentoPt } from '../../componentes/formatar'
import { ETIQUETA_VISITA, hora, NOMES_CAMPOS_VISITA, visitasApi } from './api'
import { CRITERIOS_VISITA, ECRA_VISITA } from './disposicao'

export function VisitaConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [eliminarAberto, setEliminarAberto] = useState(false)
  const { pode } = useSessao()
  const { data: x, error, isLoading } = useQuery({ queryKey: ['visitas', id], queryFn: () => visitasApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['visitas', 'opcoes'], queryFn: visitasApi.opcoes, staleTime: 60_000 })
  const eliminar = useMutation({
    mutationFn: () => visitasApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitas'] })
      navegar('/visitas', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Visita não encontrada ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar a visita.</p>
  const n = x.nomes
  const horario = [hora(x.hora_entrada), hora(x.hora_saida)].filter(Boolean).join(' – ')

  const vis = x
  function desenharCampo(c: string): ReactNode {
    if (c in CRITERIOS_VISITA)
      return <Dado rotulo={opcoes.data?.criterios.find((y) => y.campo === c)?.nome ?? CRITERIOS_VISITA[c]}>{n[c]}</Dado>
    switch (c) {
      case 'imovel':
        return (
          <Dado rotulo="Imóvel">
            {vis.imovel ? (
              <Link to={`/imoveis/${vis.imovel}`}>{vis.imovel_descricao}</Link>
            ) : (
              <>
                {vis.imovel_descricao} <small className="ajuda">(não registado no CRM)</small>
              </>
            )}
          </Dado>
        )
      case 'agente_comprador':
        return <Dado rotulo="Agente responsável pelo comprador">{vis.agente_comprador_nome}</Dado>
      case 'agente_imovel':
        return <Dado rotulo="Agente responsável pelo imóvel">{vis.agente_imovel_nome}</Dado>
      case 'entidade':
        return (
          <Dado rotulo="Cliente">
            {vis.entidade_nome ? (
              <Link to={`/entidades/${vis.entidade}`}>{vis.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
        )
      case 'data':
        return <Dado rotulo="Data">{dataPt(vis.data)}</Dado>
      case 'hora_entrada':
        return <Dado rotulo="Hora de entrada">{hora(vis.hora_entrada)}</Dado>
      case 'hora_saida':
        return <Dado rotulo="Hora de saída">{hora(vis.hora_saida)}</Dado>
      case 'estado':
        return <Dado rotulo="Estado">{vis.estado_nome}</Dado>
      case 'responsavel':
        return <Dado rotulo="Consultor">{vis.responsavel_nome}</Dado>
      case 'acompanhantes':
        return (
          <Dado rotulo="Acompanhantes" largo>
            {vis.acompanhantes_detalhe.map((a) => a.nome).join(', ')}
          </Dado>
        )
      case 'mais_gostou':
        return (
          <Dado rotulo="O que mais gostou?" largo>
            {vis.mais_gostou && <span className="texto-livre">{vis.mais_gostou}</span>}
          </Dado>
        )
      case 'menos_gostou':
        return (
          <Dado rotulo="O que menos gostou?" largo>
            {vis.menos_gostou && <span className="texto-livre">{vis.menos_gostou}</span>}
          </Dado>
        )
      case 'compraria':
        return <Dado rotulo="Compraria este imóvel?">{n.compraria}</Dado>
      case 'imovel_localizacao':
        return vis.imovel ? null : <Dado rotulo="Localização">{vis.imovel_localizacao}</Dado>
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {vis.observacoes && <span className="texto-livre">{vis.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Visitas"
        caminho="/visitas"
        referencia={x.referencia}
        titulo={`${dataPt(x.data)}${horario ? ` · ${horario}` : ''} · ${x.entidade_nome ?? 'Cliente'}`}
        etiqueta={
          x.estado_nome
            ? { texto: x.estado_nome, tipo: ETIQUETA_VISITA[x.estado_categoria ?? ''] ?? 'neutra' }
            : undefined
        }
        acoes={
          <>
            {x.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setEliminarAberto(true)}>
                Eliminar
              </button>
            )}
            {pode('propostas', 'criar') && x.estado_categoria === 'realizada' && (
              <Link to={`/propostas/nova?visita=${x.id}`} className="botao-secundario">
                Gerar Proposta
              </Link>
            )}
            {x.acoes.editar && (
              <Link to={`/visitas/${x.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <BlocosConfiguraveis
        def={ECRA_VISITA}
        modo="ver"
        campo={desenharCampo}
        abertoInicial={(b) => (b.chave === 'observacoes' ? !!x.observacoes : true)}
      />

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['visitas', x.id, 'historico']}
              obter={() => visitasApi.historico(x.id)}
              nomesCampos={NOMES_CAMPOS_VISITA}
            />
            <p className="ajuda">Criada em {momentoPt(x.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Eliminar visita"
        aberto={eliminarAberto}
        aoFechar={() => setEliminarAberto(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setEliminarAberto(false)}>
              Cancelar
            </button>
            <button className="botao-perigo" onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>Se a visita não se realizou, prefira mudar o estado para «Cancelada» ou «Não compareceu».</p>
      </Dialogo>
    </div>
  )
}
