import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { comoRegistoCp } from '../../componentes/personalizados'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, formatarEuros, formatarPercentagem, momentoPt } from '../../componentes/formatar'
import { ETIQUETA_PROPOSTA, NOMES_CAMPOS_PROPOSTA, propostasApi, type Ronda } from './api'
import { CamposRonda } from './CamposRonda'
import { RONDA_VAZIA, rondaParaApi } from './ronda'
import { ECRA_PROPOSTA } from './disposicao'

function sinal(r: Ronda) {
  if (r.sinal_valor === null) return null
  return r.sinal_unidade === 'euros' ? formatarEuros(r.sinal_valor) : formatarPercentagem(r.sinal_valor)
}

export function PropostaConsulta() {
  const { pode } = useSessao()
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [dialogo, setDialogo] = useState<null | 'ronda' | 'eliminar'>(null)
  const [ronda, setRonda] = useState(RONDA_VAZIA)
  const [errosRonda, setErrosRonda] = useState<Record<string, string[]>>({})
  // Ronda a corrigir (D-42); null = nova ronda.
  const [rondaEditar, setRondaEditar] = useState<Ronda | null>(null)
  const { data: p, error, isLoading } = useQuery({ queryKey: ['propostas', id], queryFn: () => propostasApi.obter(id) })
  const opcoes = useQuery({ queryKey: ['propostas', 'opcoes'], queryFn: propostasApi.opcoes, staleTime: 60_000 })
  const novaRonda = useMutation({
    mutationFn: () =>
      rondaEditar
        ? propostasApi.editarRonda(Number(id), rondaEditar.id, { ...rondaParaApi(ronda), data: rondaEditar.data })
        : propostasApi.novaRonda(Number(id), rondaParaApi(ronda)),
    onSuccess: (r) => {
      qc.setQueryData(['propostas', id], r)
      qc.invalidateQueries({ queryKey: ['propostas', 'lista'] })
      setDialogo(null)
    },
    onError: (e) => setErrosRonda(e instanceof ErroApi ? e.campos : { detail: ['Não foi possível gravar.'] }),
  })
  const eliminar = useMutation({
    mutationFn: () => propostasApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propostas'] })
      navegar('/propostas', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Proposta não encontrada ou sem acesso.</p>
  if (!p) return <p className="erro">Não foi possível carregar a proposta.</p>
  const emNegociacao = p.estado_categoria === 'negociacao'
  const ultima = p.rondas[p.rondas.length - 1]

  const deRonda = (r: Ronda) => ({
    autor: r.autor,
    valor: String(Number(r.valor)),
    sinal_valor: r.sinal_valor ? String(Number(r.sinal_valor)) : '',
    sinal_unidade: r.sinal_unidade || 'percentagem',
    modo_pagamento: r.modo_pagamento ? String(r.modo_pagamento) : '',
    financiamento: r.financiamento ? String(r.financiamento) : '',
    data_cpcv: r.data_cpcv ?? '',
    data_escritura: r.data_escritura ?? '',
    validade: r.validade ?? '',
    condicoes: r.condicoes,
  })

  function abrirEdicao(r: Ronda) {
    setRondaEditar(r)
    setRonda(deRonda(r))
    setErrosRonda({})
    setDialogo('ronda')
  }

  function abrirRonda() {
    setRondaEditar(null)
    // A nova ronda parte da última (normalmente só muda o valor ou uma condição) e alterna quem propõe.
    setRonda(
      ultima
        ? {
            autor: ultima.autor === 'comprador' ? 'proprietario' : 'comprador',
            valor: String(Number(ultima.valor)),
            sinal_valor: ultima.sinal_valor ? String(Number(ultima.sinal_valor)) : '',
            sinal_unidade: ultima.sinal_unidade || 'percentagem',
            modo_pagamento: ultima.modo_pagamento ? String(ultima.modo_pagamento) : '',
            financiamento: ultima.financiamento ? String(ultima.financiamento) : '',
            data_cpcv: ultima.data_cpcv ?? '',
            data_escritura: ultima.data_escritura ?? '',
            validade: '',
            condicoes: ultima.condicoes,
          }
        : RONDA_VAZIA,
    )
    setErrosRonda({})
    setDialogo('ronda')
  }

  const pr = p
  function desenharCampo(c: string): ReactNode {
    switch (c) {
      case 'valor_atual':
        return (
          <Dado rotulo="Valor atual">
            {pr.valor_atual && (
              <>
                <strong>{formatarEuros(pr.valor_atual)}</strong>{' '}
                {pr.ultima_ronda_autor && (
                  <small className="ajuda">(última oferta: {pr.ultima_ronda_autor.toLowerCase()})</small>
                )}
              </>
            )}
          </Dado>
        )
      case 'estado':
        return <Dado rotulo="Estado">{pr.estado_nome}</Dado>
      case 'imovel':
        return (
          <Dado rotulo="Imóvel">
            {pr.imovel ? (
              <Link to={`/imoveis/${pr.imovel}`}>{pr.imovel_descricao_completa}</Link>
            ) : (
              pr.imovel_descricao_completa
            )}
          </Dado>
        )
      case 'entidade':
        return (
          <Dado rotulo="Comprador">
            {pr.entidade_nome ? (
              <Link to={`/entidades/${pr.entidade}`}>{pr.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
        )
      case 'agente_comprador':
        return (
          <Dado rotulo="Responsável pela entidade">{pr.responsavel_comprador_nome ?? pr.agente_comprador_nome}</Dado>
        )
      case 'agente_imovel':
        return <Dado rotulo="Responsável pelo imóvel">{pr.responsavel_imovel_nome ?? pr.agente_imovel_nome}</Dado>
      case 'visita':
        return (
          <Dado rotulo="Visita de origem">
            {pr.visita && <Link to={`/visitas/${pr.visita}`}>{pr.visita_referencia}</Link>}
          </Dado>
        )
      case 'responsavel':
        return <Dado rotulo="Responsável">{pr.responsavel_nome}</Dado>
      case 'participantes':
        return (
          <Largo>
            <ul className="lista-relacoes">
              {pr.participantes_detalhe.map((x) => (
                <li key={x.entidade}>
                  {x.acessivel ? (
                    <Link to={`/entidades/${x.entidade}`}>{x.nome}</Link>
                  ) : (
                    <span className="vazio">{x.nome}</span>
                  )}
                  <span className="relacao-tipo">
                    {x.papel_nome ?? 'Papel não indicado'}
                    {x.quota && ` · ${formatarPercentagem(x.quota)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Largo>
        )
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
        modulo="Propostas"
        caminho="/propostas"
        referencia={p.referencia}
        titulo={`${p.entidade_nome ?? 'Comprador'} · ${p.imovel_descricao_completa}`}
        etiqueta={
          p.estado_nome
            ? { texto: p.estado_nome, tipo: ETIQUETA_PROPOSTA[p.estado_categoria ?? ''] ?? 'neutra' }
            : undefined
        }
        acoes={
          <>
            {p.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setDialogo('eliminar')}>
                Eliminar
              </button>
            )}
            {p.acoes.editar && emNegociacao && (
              <button className="botao-secundario" onClick={abrirRonda}>
                + Nova ronda / contraproposta
              </button>
            )}
            {p.transacao ? (
              <Link to={`/transacoes/${p.transacao.id}`} className="botao-secundario">
                Abrir transação {p.transacao.referencia}
              </Link>
            ) : (
              p.estado_categoria === 'aceite' &&
              pode('transacoes', 'criar') && (
                <Link to={`/transacoes/nova?proposta=${p.id}`} className="botao-principal">
                  Gerar Transação
                </Link>
              )
            )}
            {p.acoes.editar && (
              <Link to={`/propostas/${p.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <BlocosConfiguraveis
        def={ECRA_PROPOSTA}
        modo="ver"
        registo={comoRegistoCp(p)}
        campo={desenharCampo}
        abertoInicial={(b) => (b.chave === 'observacoes' ? !!p.observacoes : true)}
      />

      <Bloco titulo="Negociação" resumo={`${p.rondas.length}`}>
        <ol className="rondas">
          {[...p.rondas].reverse().map((r) => (
            <li key={r.id} className={`ronda ronda-${r.autor}`}>
              <div className="ronda-cabecalho">
                <strong>
                  {r.numero}.ª ronda · {r.autor_nome}
                </strong>
                <span className="ajuda">{dataPt(r.data)}</span>
                <strong className="ronda-valor">{formatarEuros(r.valor)}</strong>
              </div>
              <dl className="grelha-dados">
                <Dado rotulo="Sinal">{sinal(r)}</Dado>
                <Dado rotulo="Modo de pagamento">{r.modo_pagamento_nome}</Dado>
                <Dado rotulo="Depende de financiamento">{r.financiamento_nome}</Dado>
                <Dado rotulo="CPCV previsto">{dataPt(r.data_cpcv)}</Dado>
                <Dado rotulo="Escritura prevista">{dataPt(r.data_escritura)}</Dado>
                <Dado rotulo="Válida até">{dataPt(r.validade)}</Dado>
                <Dado rotulo="Condições especiais" largo>
                  {r.condicoes && <span className="texto-livre">{r.condicoes}</span>}
                </Dado>
              </dl>
              <p className="ajuda">
                Registada por {r.criado_por_nome ?? '—'} em {momentoPt(r.criado_em)}
                {p.acoes.editar && (
                  <>
                    {' '}
                    <button type="button" className="ligacao-botao" onClick={() => abrirEdicao(r)}>
                      Editar
                    </button>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
        {!emNegociacao && <p className="ajuda">A proposta já não está em negociação: não se acrescentam rondas.</p>}
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['propostas', p.id, 'historico']}
              obter={() => propostasApi.historico(p.id)}
              nomesCampos={NOMES_CAMPOS_PROPOSTA}
            />
            <p className="ajuda">Criada em {momentoPt(p.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo={rondaEditar ? `Editar ${rondaEditar.numero}.ª ronda` : 'Nova ronda / contraproposta'}
        aberto={dialogo === 'ronda'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </button>
            <button className="botao-principal" disabled={novaRonda.isPending} onClick={() => novaRonda.mutate()}>
              {rondaEditar ? 'Guardar' : 'Registar ronda'}
            </button>
          </>
        }
      >
        <div className="formulario-dialogo">
          <p className="ajuda">
            {rondaEditar
              ? 'Corrija o que estiver errado. Os valores anteriores ficam registados na auditoria.'
              : 'Cada ronda fica no histórico da negociação; se se enganar, pode corrigi-la depois.'}
          </p>
          {errosRonda.detail && <p className="erro">{errosRonda.detail}</p>}
          <CamposRonda v={ronda} aoMudar={setRonda} opcoes={opcoes.data} erros={errosRonda} />
        </div>
      </Dialogo>

      <Dialogo
        titulo="Eliminar proposta"
        aberto={dialogo === 'eliminar'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </button>
            <button className="botao-perigo" onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>Se a proposta não avançou, prefira mudar o estado para «Recusada», «Retirada» ou «Expirada».</p>
      </Dialogo>
    </div>
  )
}
