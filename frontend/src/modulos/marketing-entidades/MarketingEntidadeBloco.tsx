import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { CampoSelecao } from '../../componentes/campos'
import { dataPt } from '../../componentes/formatar'
import { inscricoesApi, planosEntidadesApi } from './api'

/** Bloco «Marketing» na ficha da entidade (D-55): planos em que está e associação à mão. */
export function MarketingEntidadeBloco({ entidade }: { entidade: number }) {
  const { pode } = useSessao()
  const qc = useQueryClient()
  const [plano, setPlano] = useState('')
  const ativo = pode('marketing-entidades')
  const lista = useQuery({
    queryKey: ['inscricoes-marketing', 'lista', { entidade: String(entidade), estado: 'todas' }],
    queryFn: () => inscricoesApi.listar({ entidade: String(entidade) }),
    enabled: ativo,
  })
  const planos = useQuery({ queryKey: ['planos-entidades'], queryFn: planosEntidadesApi.listar, enabled: ativo })
  const associar = useMutation({
    mutationFn: () => inscricoesApi.criar(entidade, Number(plano)),
    onSuccess: () => {
      setPlano('')
      qc.invalidateQueries({ queryKey: ['inscricoes-marketing'] })
      qc.invalidateQueries({ queryKey: ['tarefas'] })
    },
  })
  if (!ativo) return null
  const ins = lista.data?.results ?? []
  const emCurso = new Set(ins.filter((i) => i.estado === 'ativa').map((i) => i.plano))
  const disponiveis = (planos.data ?? []).filter((p) => p.ativo && !emCurso.has(p.id))
  const erro =
    associar.error instanceof ErroApi
      ? Object.values(associar.error.campos).flat().join(' ') || associar.error.message
      : null
  return (
    <Bloco titulo="Marketing">
      {lista.data && ins.length === 0 && <p className="ajuda">Não está em nenhum plano de marketing.</p>}
      <ul className="lista-relacoes">
        {ins.map((i) => (
          <li key={i.id}>
            <Link to={`/marketing-entidades/${i.id}`}>{i.plano_nome}</Link>
            <span className="relacao-tipo">
              desde {dataPt(i.inicio)} · {i.origem_nome}
            </span>
            <span className={`etiqueta etiqueta-${i.estado === 'ativa' ? 'aviso' : 'neutra'}`}>
              {i.estado === 'ativa' ? 'Ativa' : 'Terminada'}
            </span>
            <small className="ajuda">
              {i.progresso.concluidas} concluídas · {i.progresso.por_fazer} por fazer
            </small>
          </li>
        ))}
      </ul>
      {pode('marketing-entidades', 'criar') && disponiveis.length > 0 && (
        <div className="nova-relacao">
          <CampoSelecao
            rotulo="Associar a um plano"
            vazio="— escolha —"
            value={plano}
            onChange={(e) => setPlano(e.target.value)}
            opcoes={disponiveis.map((p) => ({ valor: p.id, nome: p.nome }))}
            erro={erro ?? undefined}
          />
          <div className="acoes-formulario largo">
            <button
              type="button"
              className="botao-secundario"
              disabled={!plano || associar.isPending}
              onClick={() => associar.mutate()}
            >
              Associar
            </button>
          </div>
        </div>
      )}
    </Bloco>
  )
}
