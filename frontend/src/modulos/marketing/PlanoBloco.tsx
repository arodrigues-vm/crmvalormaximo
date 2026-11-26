import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { CampoSelecao } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { dataPt } from '../../componentes/formatar'
import { planosApi, type PreviaPlano } from './api'
import { Semanas } from './Semanas'

/** Bloco «Plano de Marketing» nas fichas do imóvel e do CMI (D-53). Criar só a partir do CMI. */
export function PlanoBloco({
  imovel,
  angariacao,
  renovacoes = 0,
}: {
  imovel?: number
  angariacao?: number
  /** N.º de renovações do CMI: quando muda, volta a verificar-se se há um novo ciclo a propor. */
  renovacoes?: number
}) {
  const { pode } = useSessao()
  const [aCriar, setACriar] = useState<null | 'inicial' | 'ciclo'>(null)
  const situacao = useQuery({
    queryKey: ['planos-marketing', 'situacao', angariacao, renovacoes],
    queryFn: () => planosApi.situacao(angariacao!),
    enabled: !!angariacao && pode('marketing-imoveis'),
  })
  const filtro: Record<string, string> = imovel ? { imovel: String(imovel) } : { angariacao: String(angariacao) }
  const lista = useQuery({
    queryKey: ['planos-marketing', 'lista', filtro],
    queryFn: () => planosApi.listar(filtro),
    enabled: pode('marketing-imoveis'),
  })
  if (!pode('marketing-imoveis')) return null
  const planos = lista.data?.results ?? []
  return (
    <Bloco titulo="Plano de Marketing">
      {lista.data && planos.length === 0 && (
        <p className="ajuda">
          {angariacao
            ? 'Este CMI ainda não tem plano de marketing.'
            : 'Sem plano de marketing. Crie-o na ficha do CMI assinado («Criar plano inicial»).'}
        </p>
      )}
      <ul className="lista-relacoes">
        {planos.map((p) => (
          <li key={p.id}>
            <Link to={`/marketing-imoveis/${p.id}`}>{p.referencia}</Link>
            <span className="relacao-tipo">
              {p.angariacao_referencia} · {p.ciclo === 1 ? 'plano inicial' : `${p.ciclo}.º ciclo`} · início{' '}
              {dataPt(p.data_base)}
              {!p.ativo && ' · substituído'}
            </span>
            <Semanas ind={p.indicadores} compacto />
            <small className="ajuda">
              {p.indicadores.concluidas} de {p.indicadores.incluidas} concluídas
            </small>
          </li>
        ))}
      </ul>
      {angariacao && situacao.data?.plano_inicial && pode('marketing-imoveis', 'criar') && (
        <button type="button" className="botao-principal" onClick={() => setACriar('inicial')}>
          Criar plano inicial
        </button>
      )}
      {angariacao && situacao.data?.novo_ciclo && pode('marketing-imoveis', 'criar') && (
        <div className="aviso-duplicados">
          <p>
            O CMI foi renovado a partir de <strong>{dataPt(situacao.data.novo_ciclo.data_inicio)}</strong>. Quer criar
            um novo ciclo de marketing ({situacao.data.novo_ciclo.ciclo}.º ciclo)?
          </p>
          <button type="button" className="botao-principal" onClick={() => setACriar('ciclo')}>
            Novo ciclo de marketing
          </button>
        </div>
      )}
      {aCriar === 'inicial' && angariacao && (
        <DialogoCriarPlano angariacao={angariacao} aoFechar={() => setACriar(null)} />
      )}
      {aCriar === 'ciclo' && angariacao && (
        <DialogoNovoCiclo angariacao={angariacao} aoFechar={() => setACriar(null)} />
      )}
    </Bloco>
  )
}

/** Prévia das 45 ocorrências (todas marcadas), confirmação expressa e criação (Cap. 18). */
function DialogoCriarPlano({ angariacao, aoFechar }: { angariacao: number; aoFechar: () => void }) {
  const qc = useQueryClient()
  const navegar = useNavigate()
  const previa = useQuery({
    queryKey: ['planos-marketing', 'previa', angariacao],
    queryFn: () => planosApi.previa(angariacao),
    gcTime: 0,
    retry: false,
  })
  const [excluidos, setExcluidos] = useState<number[]>([])
  const criar = useMutation({
    mutationFn: () => planosApi.criar(angariacao, excluidos),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['planos-marketing', 'lista'] })
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      navegar(`/marketing-imoveis/${p.id}`)
    },
  })
  const oc = previa.data?.ocorrencias ?? []
  const erro = (previa.error ?? criar.error) as unknown
  const alternar = (n: number) => setExcluidos((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))
  return (
    <Dialogo
      titulo="Criar plano inicial de marketing"
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao-principal" disabled={!previa.data || criar.isPending} onClick={() => criar.mutate()}>
            Confirmar e criar o plano
          </button>
        </>
      }
    >
      {previa.isLoading && <p className="ajuda">A carregar…</p>}
      {previa.data && (
        <>
          <p className="ajuda">
            Data-base (início do CMI): <strong>{dataPt(previa.data.data_base)}</strong> · responsável:{' '}
            <strong>{previa.data.responsavel_nome}</strong>. Vão ser criadas {oc.length - excluidos.length} de{' '}
            {oc.length} tarefas incluídas. Desmarque as que não se aplicam (podem voltar a incluir-se no plano).
          </p>
          <ListaOcorrencias oc={oc} excluidos={excluidos} alternar={alternar} />
        </>
      )}
      {erro instanceof ErroApi && (
        <p className="erro" role="alert">
          {Object.values(erro.campos).flat().join(' ') || erro.message}
        </p>
      )}
    </Dialogo>
  )
}

function ListaOcorrencias({
  oc,
  excluidos,
  alternar,
}: {
  oc: PreviaPlano['ocorrencias']
  excluidos: number[]
  alternar: (n: number) => void
}) {
  return (
    <div className="previa-plano">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
        <fieldset key={s} className="efeitos-propostos">
          <legend>
            {s}ª semana · {dataPt(oc.find((o) => o.semana === s)?.prazo ?? '')}
          </legend>
          {oc
            .filter((o) => o.semana === s)
            .map((o) => (
              <label key={o.numero} className="efeito-opcao">
                <input type="checkbox" checked={!excluidos.includes(o.numero)} onChange={() => alternar(o.numero)} />
                {o.numero}. {o.designacao}
              </label>
            ))}
        </fieldset>
      ))}
    </div>
  )
}

/** Novo ciclo após renovação (Cap. 19): origem, destino das pendentes, prévia e confirmação expressa. */
function DialogoNovoCiclo({ angariacao, aoFechar }: { angariacao: number; aoFechar: () => void }) {
  const qc = useQueryClient()
  const navegar = useNavigate()
  const [origem, setOrigem] = useState('catalogo')
  const [destino, setDestino] = useState('')
  // Desmarcações feitas pelo utilizador por cima da origem escolhida (por n.º do catálogo).
  const [alteradas, setAlteradas] = useState<Record<number, boolean>>({})
  const previa = useQuery({
    queryKey: ['planos-marketing', 'previa-ciclo', angariacao, origem],
    queryFn: () => planosApi.previaCiclo(angariacao, origem),
    gcTime: 0,
    retry: false,
  })
  const oc = previa.data?.ocorrencias ?? []
  const excluidos = oc.filter((o) => !(alteradas[o.numero] ?? o.incluida)).map((o) => o.numero)
  const criar = useMutation({
    mutationFn: () => planosApi.novoCiclo({ angariacao, origem, destino, excluidos }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['planos-marketing', 'lista'] })
      qc.invalidateQueries({ queryKey: ['planos-marketing', 'situacao'] })
      qc.invalidateQueries({ queryKey: ['tarefas'] })
      navegar(`/marketing-imoveis/${p.id}`)
    },
  })
  const erro = (previa.error ?? criar.error) as unknown
  const pend = previa.data?.anterior.pendentes ?? []
  return (
    <Dialogo
      titulo="Novo ciclo de marketing"
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            className="botao-principal"
            disabled={!previa.data || !destino || criar.isPending}
            onClick={() => criar.mutate()}
          >
            Confirmar e criar o ciclo
          </button>
        </>
      }
    >
      {previa.data && (
        <>
          <p className="ajuda">
            {previa.data.ciclo}.º ciclo · data-base (início da renovação):{' '}
            <strong>{dataPt(previa.data.data_base)}</strong> · responsável:{' '}
            <strong>{previa.data.responsavel_nome}</strong>. O plano anterior ({previa.data.anterior.referencia}) fica
            guardado com as suas datas, tarefas concluídas e histórico.
          </p>
          <CampoSelecao
            rotulo="Origem das tarefas do novo ciclo"
            value={origem}
            onChange={(e) => {
              setOrigem(e.target.value)
              setAlteradas({})
            }}
            opcoes={previa.data.origens.map((o) => ({ valor: o.valor, nome: o.nome }))}
          />
          <CampoSelecao
            rotulo={`Tarefas por fazer do plano anterior (${pend.length})`}
            vazio="— escolha —"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            opcoes={previa.data.destinos.map((o) => ({ valor: o.valor, nome: o.nome }))}
          />
          <p className="ajuda">
            Vão ser criadas {oc.length - excluidos.length} de {oc.length} tarefas incluídas.
          </p>
          <ListaOcorrencias
            oc={oc}
            excluidos={excluidos}
            alternar={(n) => setAlteradas((a) => ({ ...a, [n]: excluidos.includes(n) }))}
          />
        </>
      )}
      {previa.isLoading && <p className="ajuda">A carregar…</p>}
      {erro instanceof ErroApi && (
        <p className="erro" role="alert">
          {Object.values(erro.campos).flat().join(' ') || erro.message}
        </p>
      )}
    </Dialogo>
  )
}
