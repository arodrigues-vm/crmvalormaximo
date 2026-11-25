import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { formatarEuros, momentoPt } from '../../componentes/formatar'
import type { Registo } from '../../componentes/camposQualificacao'
import { Interacoes } from '../../componentes/Interacoes'
import { VerCampoQ } from '../../componentes/Qualificacao'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { ETIQUETA_CATEGORIA } from '../oportunidades/api'
import {
  NOMES_CAMPOS_PROCURA,
  CRITERIOS_INFORMATIVOS,
  PRE_QUALIFICACAO_FINANCEIRA,
  procurasApi,
  QUALIFICACAO_COMPRADOR,
  type Importancia,
} from './api'
import { CorrespondenciasProcura } from './Correspondencias'
import { ECRA_PROCURA } from './disposicao'

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

  const pr = p
  const CAMPOS_Q = [...QUALIFICACAO_COMPRADOR, ...PRE_QUALIFICACAO_FINANCEIRA, ...CRITERIOS_INFORMATIVOS]
  function desenharCampo(c: string): ReactNode {
    const q = CAMPOS_Q.find((x) => x.campo === c)
    if (q) return <VerCampoQ c={q} registo={pr as unknown as Registo} />
    switch (c) {
      case 'entidade':
        return (
          <Dado rotulo="Comprador / arrendatário">
            {pr.entidade_nome ? (
              <Link to={`/entidades/${pr.entidade}`}>{pr.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
        )
      case 'pretende':
        return <Dado rotulo="O cliente pretende">{n.pretende}</Dado>
      case 'estado':
        return <Dado rotulo="Estado">{n.estado}</Dado>
      case 'urgencia':
        return <Dado rotulo="Urgência">{n.urgencia}</Dado>
      case 'responsavel':
        return <Dado rotulo="Responsável">{pr.responsavel_nome}</Dado>
      case 'orcamento_max':
        return <Dado rotulo="Valor de aquisição previsto">{formatarEuros(pr.orcamento_max)}</Dado>
      case 'tolerancia_pct':
        return (
          <>
            <Dado rotulo="Tolerância">{`${Number(pr.tolerancia_pct)} %`}</Dado>
            <Dado rotulo="Preço máximo aceite">{formatarEuros(pr.teto)}</Dado>
          </>
        )
      case 'crit_tipos':
        return crit('Tipo', n.tipos.join(', '), pr.imp_tipos)
      case 'crit_tipologias':
        return crit('Tipologia', n.tipologias.join(', '), pr.imp_tipologias)
      case 'crit_localizacao':
        return crit('Localização', localizacao, pr.imp_localizacao)
      case 'crit_area':
        return crit('Área bruta privativa', pr.area_min !== null && `${Number(pr.area_min)} m² ou mais`, pr.imp_area)
      case 'crit_quartos':
        return crit('Quartos', pr.quartos_min !== null && `${pr.quartos_min} ou mais`, pr.imp_quartos)
      case 'crit_wcs':
        return crit('Casas de banho', pr.wcs_min !== null && `${pr.wcs_min} ou mais`, pr.imp_wcs)
      case 'crit_elevador':
        return crit('Elevador', pr.exige_elevador && 'Sim', pr.imp_elevador)
      case 'crit_estacionamento':
        return crit(
          'Estacionamento',
          pr.estacionamento_min !== null && `${pr.estacionamento_min} lugar(es) ou mais`,
          pr.imp_estacionamento,
        )
      case 'crit_zonas_exteriores':
        return crit('Zonas exteriores', n.zonas_exteriores.join(', '), pr.imp_zonas_exteriores)
      case 'crit_condicoes':
        return crit('Condição física', n.condicoes_fisicas.join(', '), pr.imp_condicoes)
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {pr.observacoes && <span className="texto-livre">{pr.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Procuras"
        caminho="/procuras"
        referencia={p.referencia}
        titulo={`${p.entidade_nome ?? 'Interessado'} · Pretende ${(n.pretende ?? '').toLowerCase()}`}
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

      <BlocosConfiguraveis
        def={ECRA_PROCURA}
        modo="ver"
        campo={desenharCampo}
        abertoInicial={(b) => (b.chave === 'observacoes' ? !!p.observacoes : true)}
      />

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
