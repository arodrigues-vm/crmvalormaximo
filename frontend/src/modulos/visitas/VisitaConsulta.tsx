import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, momentoPt } from '../../componentes/formatar'
import { ETIQUETA_VISITA, hora, NOMES_CAMPOS_VISITA, visitasApi } from './api'

export function VisitaConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [eliminarAberto, setEliminarAberto] = useState(false)
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
            {x.acoes.editar && (
              <Link to={`/visitas/${x.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <Bloco titulo="Visita">
        <dl className="grelha-dados">
          <Dado rotulo="Imóvel">
            {x.imovel ? (
              <Link to={`/imoveis/${x.imovel}`}>{x.imovel_descricao}</Link>
            ) : (
              <>
                {x.imovel_descricao} <small className="ajuda">(não registado no CRM)</small>
              </>
            )}
          </Dado>
          <Dado rotulo="Agente responsável pelo comprador">{x.agente_comprador_nome}</Dado>
          <Dado rotulo="Agente responsável pelo imóvel">{x.agente_imovel_nome}</Dado>
          <Dado rotulo="Cliente">
            {x.entidade_nome ? (
              <Link to={`/entidades/${x.entidade}`}>{x.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
          <Dado rotulo="Data">{dataPt(x.data)}</Dado>
          <Dado rotulo="Hora de entrada">{hora(x.hora_entrada)}</Dado>
          <Dado rotulo="Hora de saída">{hora(x.hora_saida)}</Dado>
          <Dado rotulo="Estado">{x.estado_nome}</Dado>
          <Dado rotulo="Consultor">{x.responsavel_nome}</Dado>
          <Dado rotulo="Acompanhantes" largo>
            {x.acompanhantes_detalhe.map((a) => a.nome).join(', ')}
          </Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Avaliação do cliente">
        <dl className="grelha-dados">
          {(opcoes.data?.criterios ?? []).map((c) => (
            <Dado key={c.campo} rotulo={c.nome}>
              {n[c.campo]}
            </Dado>
          ))}
          <Dado rotulo="O que mais gostou?" largo>
            {x.mais_gostou && <span className="texto-livre">{x.mais_gostou}</span>}
          </Dado>
          <Dado rotulo="O que menos gostou?" largo>
            {x.menos_gostou && <span className="texto-livre">{x.menos_gostou}</span>}
          </Dado>
          <Dado rotulo="Compraria este imóvel?">{n.compraria}</Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!x.observacoes}>
        <p className="texto-livre">{x.observacoes || <span className="vazio">—</span>}</p>
      </Bloco>

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
