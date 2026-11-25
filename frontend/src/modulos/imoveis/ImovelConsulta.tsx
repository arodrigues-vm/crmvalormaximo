import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { formatarPercentagem, momentoPt } from '../../componentes/formatar'
import type { Registo } from '../../componentes/camposQualificacao'
import { VerCampoQ } from '../../componentes/Qualificacao'
import { comoRegistoCp } from '../../componentes/personalizados'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { LigacoesExternas } from '../../componentes/LigacoesExternas'
import { pedido } from '../../api/cliente'
import { CAMPOS_IMOVEL, etiquetaStatus, imoveisApi, NOMES_CAMPOS_IMOVEL, tituloImovel } from './api'
import { AngariacoesDoImovel } from './AngariacoesDoImovel'
import { ProcurasCompativeis } from './ProcurasCompativeis'
import { ECRA_IMOVEL, IMOVEL_SECUNDARIOS } from './disposicao'
import { FotografiaImovel } from './FotografiaImovel'
import { VisitasDoRegisto } from '../visitas/VisitasDoRegisto'
import { useSessao } from '../../app/sessao'

const preenchido = (x: unknown) => x !== null && x !== undefined && x !== ''

export function ImovelConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [confirmar, setConfirmar] = useState(false)
  const [duplicarAberto, setDuplicarAberto] = useState(false)
  const { data: i, error, isLoading } = useQuery({ queryKey: ['imoveis', id], queryFn: () => imoveisApi.obter(id) })
  const { pode } = useSessao()
  const tiposLigacao = useQuery({
    queryKey: ['listas', 'tipos_ligacao', 'opcoes'],
    queryFn: async () =>
      (await pedido<{ chave: string; valores: { id: number; nome: string; ativo: boolean }[] }[]>('/api/listas/'))
        .find((l) => l.chave === 'tipos_ligacao')
        ?.valores.filter((v) => v.ativo) ?? [],
    staleTime: 60_000,
  })
  const eliminar = useMutation({
    mutationFn: () => imoveisApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      navegar('/imoveis', { replace: true })
    },
  })

  const duplicar = useMutation({
    mutationFn: () => imoveisApi.duplicar(Number(id)),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      setDuplicarAberto(false)
      navegar(`/imoveis/${r.id}/editar`)
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Imóvel não encontrado ou sem acesso.</p>
  if (!i) return <p className="erro">Não foi possível carregar o imóvel.</p>

  const n = i.nomes
  const registo = i as unknown as Registo
  const somaQuotas = i.proprietarios_detalhe.reduce((s, p) => s + (p.quota ? Number(p.quota) : 0), 0)
  const todasQuotas = i.proprietarios_detalhe.length > 0 && i.proprietarios_detalhe.every((p) => p.quota !== null)

  const proprietarios = (
    <>
      {i.proprietarios_detalhe.length === 0 ? (
        <p className="ajuda">Sem proprietários registados.</p>
      ) : (
        <>
          <ul className="lista-relacoes">
            {i.proprietarios_detalhe.map((p) => (
              <li key={p.entidade}>
                {p.acessivel ? (
                  <Link to={`/entidades/${p.entidade}`}>
                    {p.nome_completo} <small className="ajuda">{p.referencia}</small>
                  </Link>
                ) : (
                  <span className="vazio">Entidade a que não tem acesso</span>
                )}
                <span className="relacao-tipo">{formatarPercentagem(p.quota) ?? 'Quota não indicada'}</span>
              </li>
            ))}
          </ul>
          {todasQuotas && Math.abs(somaQuotas - 100) > 0.0001 && (
            <p className="aviso-duplicados">A soma das quotas é {formatarPercentagem(String(somaQuotas))}.</p>
          )}
        </>
      )}
    </>
  )

  function desenharCampo(c: string) {
    const q = CAMPOS_IMOVEL.find((x) => x.campo === c)
    if (q) return <VerCampoQ c={q} registo={registo} />
    switch (c) {
      case 'operacao':
        return <Dado rotulo="Operação">{n.operacao}</Dado>
      case 'estado_comercializacao':
        return <Dado rotulo="Estado de comercialização">{n.estado_comercializacao}</Dado>
      case 'status':
        return <Dado rotulo="Status">{n.status}</Dado>
      case 'angariacao':
        return <Dado rotulo="Angariação">{(n.angariacao as string | null) ?? 'Própria'}</Dado>
      case 'responsavel':
        return <Dado rotulo="Responsável">{i!.responsavel_imovel_nome}</Dado>
      case 'zonas_exteriores':
        return (
          <Dado rotulo="Zonas exteriores" largo>
            {n.zonas_exteriores.join(', ')}
          </Dado>
        )
      case 'freguesia':
        return (
          <Dado rotulo="Distrito, concelho e freguesia" largo>
            {i!.localizacao && `${i!.localizacao.distrito} › ${i!.localizacao.concelho} › ${i!.localizacao.freguesia}`}
          </Dado>
        )
      case 'proprietarios':
        return <Largo>{proprietarios}</Largo>
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Imóveis"
        caminho="/imoveis"
        referencia={i.referencia}
        titulo={tituloImovel({ tipo: n.tipo, tipologia: n.tipologia, localidade: i.localidade })}
        etiqueta={n.status ? { texto: n.status, tipo: etiquetaStatus(n.status_categoria) } : undefined}
        acoes={
          <>
            {i.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setConfirmar(true)}>
                Eliminar
              </button>
            )}
            {pode('imoveis', 'criar') && (
              <button className="botao-secundario" onClick={() => setDuplicarAberto(true)}>
                Duplicar imóvel
              </button>
            )}
            {i.acoes.editar && (
              <Link to={`/imoveis/${i.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      {i.duplicado_de && (
        <p className="aviso-duplicados">
          Este imóvel é uma nova comercialização de{' '}
          <Link to={`/imoveis/${i.duplicado_de}`}>{i.duplicado_de_referencia}</Link>.
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_IMOVEL}
        modo="ver"
        registo={comoRegistoCp(i)}
        campo={desenharCampo}
        aoLadoDoPrimeiro={<FotografiaImovel imovel={i} />}
        abertoInicial={(b) => !IMOVEL_SECUNDARIOS.has(b.chave) || b.campos.some((c) => preenchido(registo[c]))}
      />

      <Bloco titulo="Angariações (CMI)">
        <AngariacoesDoImovel imovelId={i.id} podeCriar={pode('angariacoes', 'criar')} />
      </Bloco>

      <Bloco titulo="Fotografias, documentos e outras ligações">
        <LigacoesExternas
          base={`/api/imoveis/${i.id}/ligacoes/`}
          podeEditar={i.acoes.editar}
          tipos={tiposLigacao.data ?? []}
        />
      </Bloco>

      {pode('visitas') && (
        <Bloco titulo="Visitas e interessados" abertoInicial={false}>
          {() => <VisitasDoRegisto filtro={{ imovel: i.id }} podeCriar={pode('visitas', 'criar')} />}
        </Bloco>
      )}

      {pode('procuras') && (
        <Bloco titulo="Procuras compatíveis" abertoInicial={false}>
          {() => <ProcurasCompativeis imovelId={i.id} versao={i.versao} />}
        </Bloco>
      )}

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['imoveis', i.id, 'historico']}
              obter={() => imoveisApi.historico(i.id)}
              nomesCampos={NOMES_CAMPOS_IMOVEL}
            />
            <p className="ajuda">
              Criado em {momentoPt(i.criado_em)} · última alteração em {momentoPt(i.atualizado_em)}
            </p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Duplicar imóvel"
        aberto={duplicarAberto}
        aoFechar={() => setDuplicarAberto(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDuplicarAberto(false)}>
              Cancelar
            </button>
            <button className="botao-principal" disabled={duplicar.isPending} onClick={() => duplicar.mutate()}>
              Duplicar
            </button>
          </>
        }
      >
        <p>
          Use quando o imóvel <strong>{i.referencia}</strong> volta ao mercado depois de vendido, cancelado ou
          rescindido. É criado um <strong>imóvel novo</strong> com as mesmas características, proprietários e
          fotografia, em <em>Em preparação</em>. A seguir abre-se a edição para atualizar o que mudou (por exemplo, os
          proprietários). Este imóvel fica como está, com o seu histórico e contratos.
        </p>
        {duplicar.error && (
          <p className="erro" role="alert">
            {duplicar.error instanceof ErroApi ? duplicar.error.message : 'Não foi possível duplicar.'}
          </p>
        )}
      </Dialogo>

      <Dialogo
        titulo="Eliminar imóvel"
        aberto={confirmar}
        aoFechar={() => setConfirmar(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>
          O imóvel <strong>{i.referencia}</strong> será enviado para a lixeira. Pode ser restaurado por um utilizador
          autorizado. Se apenas deixou de estar em comercialização, prefira mudar o <strong>Status</strong>.
        </p>
      </Dialogo>
    </div>
  )
}
