import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, formatarEuros, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { ETIQUETA_CATEGORIA } from '../oportunidades/api'
import { NOMES_CAMPOS_PROCURA, procurasApi, type Importancia } from './api'
import { CorrespondenciasProcura } from './Correspondencias'

const IMP: Record<Importancia, string> = { obrigatorio: 'obrigatório', preferencial: 'preferencial' }

export function ProcuraConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [eliminarAberto, setEliminarAberto] = useState(false)
  const { data: p, error, isLoading } = useQuery({ queryKey: ['procuras', id], queryFn: () => procurasApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['procuras', 'opcoes'], queryFn: procurasApi.opcoes, staleTime: 60_000 })
  const corresp = useQuery({
    queryKey: ['procuras', id, 'correspondencias', p?.versao],
    queryFn: () => procurasApi.correspondencias(Number(id)),
    enabled: !!p,
  })
  const eliminar = useMutation({
    mutationFn: () => procurasApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procuras'] })
      navegar('/procuras', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Procura não encontrada ou sem acesso.</p>
  if (!p) return <p className="erro">Não foi possível carregar a procura.</p>
  const n = p.nomes
  const crit = (rotulo: string, valor: string | null | false, imp: Importancia) =>
    valor ? (
      <Dado rotulo={rotulo}>
        {valor} <small className="ajuda">({IMP[imp]})</small>
      </Dado>
    ) : null
  const localizacao = [
    ...n.concelhos.map((c) => `${c.nome} (concelho)`),
    ...n.freguesias.map((f) => f.nome),
    ...n.zonas_comerciais,
  ].join(', ')

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Procuras"
        caminho="/procuras"
        referencia={p.referencia}
        titulo={`${p.entidade_nome ?? 'Interessado'} · ${n.operacao ?? ''}`}
        etiqueta={
          n.estado ? { texto: n.estado, tipo: ETIQUETA_CATEGORIA[p.estado_categoria ?? ''] ?? 'neutra' } : undefined
        }
        acoes={
          <>
            {p.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setEliminarAberto(true)}>
                Eliminar
              </button>
            )}
            {p.acoes.editar && (
              <Link to={`/procuras/${p.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <Bloco titulo="Interessado e qualificação">
        <dl className="grelha-dados">
          <Dado rotulo="Interessado">
            {p.entidade_nome ? (
              <Link to={`/entidades/${p.entidade}`}>{p.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
          <Dado rotulo="Operação">{n.operacao}</Dado>
          <Dado rotulo="Qualificação">{n.qualificacao}</Dado>
          <Dado rotulo="Urgência">{n.urgencia}</Dado>
          <Dado rotulo="Início da procura">{dataPt(p.data_inicio)}</Dado>
          <Dado rotulo="Prazo">{dataPt(p.prazo_compra)}</Dado>
          <Dado rotulo="Responsável">{p.responsavel_nome}</Dado>
          <Dado rotulo="Motivação" largo>
            {p.motivacao && <span className="texto-livre">{p.motivacao}</span>}
          </Dado>
          <Dado rotulo="Flexibilidade" largo>
            {p.flexibilidade && <span className="texto-livre">{p.flexibilidade}</span>}
          </Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Critérios">
        <dl className="grelha-dados">
          <Dado rotulo="Orçamento">
            {p.orcamento_max &&
              `${formatarEuros(p.orcamento_max)}${Number(p.tolerancia_pct) > 0 ? ` + ${Number(p.tolerancia_pct)}% → máximo ${formatarEuros(p.teto)}` : ''}`}
          </Dado>
          {crit('Tipo', n.tipos.join(', '), p.imp_tipos)}
          {crit('Tipologia', n.tipologias.join(', '), p.imp_tipologias)}
          {crit('Localização', localizacao, p.imp_localizacao)}
          {crit('Quartos', p.quartos_min !== null && `${p.quartos_min} ou mais`, p.imp_quartos)}
          {crit('Área', p.area_min !== null && `${Number(p.area_min)} m² ou mais`, p.imp_area)}
          {crit('Zonas exteriores', n.zonas_exteriores.join(', '), p.imp_zonas_exteriores)}
          {crit('Elevador', p.exige_elevador && 'Sim', p.imp_elevador)}
          {crit(
            'Estacionamento',
            p.estacionamento_min !== null && `${p.estacionamento_min} lugar(es) ou mais`,
            p.imp_estacionamento,
          )}
          {crit('Condição física', n.condicoes_fisicas.join(', '), p.imp_condicoes)}
        </dl>
      </Bloco>

      <Bloco titulo="Imóveis compatíveis" resumo={corresp.data ? `${corresp.data.resultados.length}` : undefined}>
        {p.estado_categoria === 'inativa' && (
          <p className="aviso-duplicados">Esta procura está inativa; a lista é apenas indicativa.</p>
        )}
        {corresp.isLoading ? (
          <p className="ajuda">A procurar…</p>
        ) : (
          <CorrespondenciasProcura resultados={corresp.data?.resultados ?? []} />
        )}
      </Bloco>

      <Bloco titulo="Contactos registados" abertoInicial={false}>
        <Interacoes
          base={`/api/procuras/${p.id}/interacoes/`}
          podeEditar={p.acoes.editar}
          tipos={opcoes.data?.tipos_interacao ?? []}
        />
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!p.observacoes}>
        <p className="texto-livre">{p.observacoes || <span className="vazio">—</span>}</p>
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['procuras', p.id, 'historico']}
              obter={() => procurasApi.historico(p.id)}
              nomesCampos={NOMES_CAMPOS_PROCURA}
            />
            <p className="ajuda">Criada em {momentoPt(p.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Eliminar procura"
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
        <p>Se o cliente já comprou ou desistiu, prefira mudar o estado da procura.</p>
      </Dialogo>
    </div>
  )
}
