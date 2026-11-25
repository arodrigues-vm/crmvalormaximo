import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { comoRegistoCp } from '../../componentes/personalizados'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { ETIQUETA_VISITA, hora, interessesApi, NOMES_CAMPOS_INTERESSE, visitasApi } from './api'
import { ECRA_INTERESSE } from './disposicao'

export function InteresseConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [eliminarAberto, setEliminarAberto] = useState(false)
  const {
    data: x,
    error,
    isLoading,
  } = useQuery({ queryKey: ['interesses', id], queryFn: () => interessesApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['interesses', 'opcoes'], queryFn: interessesApi.opcoes, staleTime: 60_000 })
  const visitas = useQuery({
    queryKey: ['visitas', 'lista', { entidade: x?.entidade, imovel: x?.imovel }],
    queryFn: () => visitasApi.listar({ entidade: String(x!.entidade), imovel: String(x!.imovel) }),
    enabled: !!x,
  })
  const eliminar = useMutation({
    mutationFn: () => interessesApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interesses'] })
      navegar('/visitas/interesses', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Interesse não encontrado ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar o interesse.</p>

  const int = x
  function desenharCampo(c: string): ReactNode {
    switch (c) {
      case 'entidade':
        return (
          <Dado rotulo="Cliente">
            {int.entidade_nome ? (
              <Link to={`/entidades/${int.entidade}`}>{int.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
        )
      case 'imovel':
        return (
          <Dado rotulo="Imóvel">
            <Link to={`/imoveis/${int.imovel}`}>{int.imovel_descricao}</Link>
          </Dado>
        )
      case 'origem':
        return <Dado rotulo="Origem">{int.origem_nome}</Dado>
      case 'grau':
        return <Dado rotulo="Grau de interesse">{int.grau_nome}</Dado>
      case 'estado':
        return <Dado rotulo="Estado">{int.estado_nome}</Dado>
      case 'ultima_visita':
        return <Dado rotulo="Última visita">{dataPt(int.ultima_visita)}</Dado>
      case 'responsavel':
        return <Dado rotulo="Responsável">{int.responsavel_nome}</Dado>
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {int.observacoes && <span className="texto-livre">{int.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Interesses"
        caminho="/visitas/interesses"
        referencia={x.referencia}
        titulo={`${x.entidade_nome ?? 'Cliente'} · ${x.imovel_descricao}`}
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
            <Link to={`/visitas/nova?imovel=${x.imovel}&entidade=${x.entidade}`} className="botao-secundario">
              + Agendar visita
            </Link>
            {x.acoes.editar && (
              <Link to={`/visitas/interesses/${x.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <BlocosConfiguraveis def={ECRA_INTERESSE} modo="ver" registo={comoRegistoCp(x)} campo={desenharCampo} />

      <Bloco titulo="Visitas" resumo={visitas.data ? String(visitas.data.count) : undefined}>
        {visitas.data?.count === 0 && <p className="ajuda">Ainda sem visitas a este imóvel.</p>}
        <ul className="lista-relacoes">
          {visitas.data?.results.map((v) => (
            <li key={v.id}>
              <Link to={`/visitas/${v.id}`}>
                {dataPt(v.data)}
                {v.hora_entrada && ` ${hora(v.hora_entrada)}`}
              </Link>
              <span className={`etiqueta etiqueta-${ETIQUETA_VISITA[v.estado_categoria ?? ''] ?? 'neutra'}`}>
                {v.estado_nome}
              </span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Acompanhamentos">
        <Interacoes
          base={`/api/interesses/${x.id}/interacoes/`}
          podeEditar={x.acoes.editar}
          tipos={opcoes.data?.tipos_interacao ?? []}
        />
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['interesses', x.id, 'historico']}
              obter={() => interessesApi.historico(x.id)}
              nomesCampos={NOMES_CAMPOS_INTERESSE}
            />
            <p className="ajuda">Criado em {momentoPt(x.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Eliminar interesse"
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
        <p>Se o cliente deixou de estar interessado, prefira mudar o estado para «Desistiu».</p>
      </Dialogo>
    </div>
  )
}
