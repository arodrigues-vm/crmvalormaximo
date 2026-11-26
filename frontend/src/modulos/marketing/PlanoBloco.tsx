import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { Dialogo } from '../../componentes/Dialogo'
import { dataPt } from '../../componentes/formatar'
import { planosApi } from './api'
import { Semanas } from './Semanas'

/** Bloco «Plano de Marketing» nas fichas do imóvel e do CMI (D-53). Criar só a partir do CMI. */
export function PlanoBloco({ imovel, angariacao }: { imovel?: number; angariacao?: number }) {
  const { pode } = useSessao()
  const [aCriar, setACriar] = useState(false)
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
              {p.angariacao_referencia} · início {dataPt(p.data_base)}
            </span>
            <Semanas ind={p.indicadores} compacto />
            <small className="ajuda">
              {p.indicadores.concluidas} de {p.indicadores.incluidas} concluídas
            </small>
          </li>
        ))}
      </ul>
      {angariacao && planos.length === 0 && pode('marketing-imoveis', 'criar') && (
        <button type="button" className="botao-principal" onClick={() => setACriar(true)}>
          Criar plano inicial
        </button>
      )}
      {aCriar && angariacao && <DialogoCriarPlano angariacao={angariacao} aoFechar={() => setACriar(false)} />}
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
                      <input
                        type="checkbox"
                        checked={!excluidos.includes(o.numero)}
                        onChange={() => alternar(o.numero)}
                      />
                      {o.numero}. {o.designacao}
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>
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
