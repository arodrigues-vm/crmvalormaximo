import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { ETIQUETA_VISITA, hora, interessesApi, NOMES_CAMPOS_INTERESSE, visitasApi } from './api'

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

      <Bloco titulo="Interesse">
        <dl className="grelha-dados">
          <Dado rotulo="Cliente">
            {x.entidade_nome ? (
              <Link to={`/entidades/${x.entidade}`}>{x.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
          <Dado rotulo="Imóvel">
            <Link to={`/imoveis/${x.imovel}`}>{x.imovel_descricao}</Link>
          </Dado>
          <Dado rotulo="Origem">{x.origem_nome}</Dado>
          <Dado rotulo="Grau de interesse">{x.grau_nome}</Dado>
          <Dado rotulo="Estado">{x.estado_nome}</Dado>
          <Dado rotulo="Última visita">{dataPt(x.ultima_visita)}</Dado>
          <Dado rotulo="Responsável">{x.responsavel_nome}</Dado>
          <Dado rotulo="Observações" largo>
            {x.observacoes && <span className="texto-livre">{x.observacoes}</span>}
          </Dado>
        </dl>
      </Bloco>

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
