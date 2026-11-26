import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, formatarEuros, formatarPercentagem, momentoPt } from '../../componentes/formatar'
import { comoRegistoCp } from '../../componentes/personalizados'
import { documentosApi, NOMES_CAMPOS_DOCUMENTO, type Documento, type Movimento } from './api'
import { ECRA_DOCUMENTO } from './disposicao'

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' })
const mensagem = (e: unknown) =>
  e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Não foi possível gravar.'

export function DocumentoConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const { utilizador } = useSessao()
  const [dialogo, setDialogo] = useState<
    null | 'pagamento' | 'eliminar' | { estornar: Movimento } | { decidir: Movimento }
  >(null)
  const {
    data: d,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['documentos-consultor', id],
    queryFn: () => documentosApi.obter(id),
  })
  const atualizar = (n: Documento) => {
    qc.setQueryData(['documentos-consultor', id], n)
    qc.invalidateQueries({ queryKey: ['documentos-consultor', 'lista'] })
    qc.invalidateQueries({ queryKey: ['comissoes'] })
    setDialogo(null)
  }
  const eliminar = useMutation({
    mutationFn: () => documentosApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documentos-consultor'] })
      qc.invalidateQueries({ queryKey: ['comissoes'] })
      navegar('/faturacao/documentos', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Documento não encontrado ou sem acesso.</p>
  if (!d) return <p className="erro">Não foi possível carregar o documento.</p>
  const doc = d
  const credito = d.tipo_categoria === 'credito'
  const emFalta = Number(d.saldo.em_aberto)

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'comissao':
        return (
          <Dado rotulo="Comissão">
            <Link to={`/faturacao/comissoes/${doc.comissao}`}>{doc.comissao_referencia}</Link>{' '}
            <small className="ajuda">· {doc.transacao_referencia}</small>
          </Dado>
        )
      case 'consultor':
        return <Dado rotulo="Consultor">{doc.consultor_nome}</Dado>
      case 'prestacao':
        return <Dado rotulo="Prestação">{doc.prestacao_descricao}</Dado>
      case 'tipo':
        return <Dado rotulo="Tipo de documento">{doc.tipo_nome}</Dado>
      case 'documento_original':
        return credito ? (
          <Dado rotulo="Documento retificado">
            {doc.documento_original && (
              <Link to={`/faturacao/documentos/${doc.documento_original}`}>{doc.documento_original_referencia}</Link>
            )}
          </Dado>
        ) : null
      case 'serie':
        return <Dado rotulo="Série">{doc.serie}</Dado>
      case 'numero':
        return <Dado rotulo="Número">{doc.numero}</Dado>
      case 'data_emissao':
        return <Dado rotulo="Data de emissão">{dataPt(doc.data_emissao)}</Dado>
      case 'base':
        return <Dado rotulo="Base (sem IVA)">{formatarEuros(doc.base)}</Dado>
      case 'taxa_iva':
        return <Dado rotulo="Taxa de IVA">{formatarPercentagem(doc.taxa_iva)}</Dado>
      case 'iva':
        return <Dado rotulo="IVA">{formatarEuros(doc.iva)}</Dado>
      case 'retencao':
        return <Dado rotulo="Retenção na fonte">{formatarEuros(doc.retencao)}</Dado>
      case 'total':
        return <Dado rotulo="Total do documento">{formatarEuros(doc.total)}</Dado>
      case 'saldo':
        return credito ? (
          <Dado rotulo="Reduz o valor a pagar ao consultor em">
            {formatarEuros(doc.saldo.a_pagar.replace('-', ''))}
          </Dado>
        ) : (
          <>
            <Dado rotulo="A pagar (total − retenção)">{formatarEuros(doc.saldo.a_pagar)}</Dado>
            <Dado rotulo="Pago">{formatarEuros(doc.saldo.pago)}</Dado>
            <Dado rotulo="Em falta">
              <strong>{formatarEuros(doc.saldo.em_aberto)}</strong>
              {Number(doc.saldo.estornos_pendentes) > 0 && (
                <small className="ajuda"> · estornos pendentes: {formatarEuros(doc.saldo.estornos_pendentes)}</small>
              )}
            </Dado>
          </>
        )
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {doc.observacoes && <span className="texto-livre">{doc.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Faturação e Comissões"
        caminho="/faturacao/documentos"
        referencia={d.referencia}
        titulo={`${d.tipo_nome} ${[d.serie, d.numero].filter(Boolean).join('/')} · ${d.consultor_nome}`}
        etiqueta={
          credito
            ? { texto: 'Nota de crédito', tipo: 'neutra' }
            : emFalta <= 0
              ? { texto: 'Pago', tipo: 'sucesso' }
              : { texto: 'Por pagar', tipo: 'aviso' }
        }
        acoes={
          <>
            {d.acoes.eliminar && d.movimentos.length === 0 && (
              <button className="botao-secundario" onClick={() => setDialogo('eliminar')}>
                Eliminar
              </button>
            )}
            {d.acoes.editar && !credito && emFalta > 0 && (
              <button className="botao-principal" onClick={() => setDialogo('pagamento')}>
                Registar pagamento
              </button>
            )}
            {d.acoes.editar && (
              <Link to={`/faturacao/documentos/${d.id}/editar`} className="botao-secundario">
                Editar
              </Link>
            )}
          </>
        }
      />

      <BlocosConfiguraveis
        def={ECRA_DOCUMENTO}
        modo="ver"
        registo={comoRegistoCp(d)}
        campo={desenharCampo}
        abertoInicial={(b) => b.chave !== 'observacoes' || !!d.observacoes}
      />

      {!credito && (
        <Bloco titulo="Pagamentos (livro)" resumo={d.movimentos.length ? `${d.movimentos.length}` : undefined}>
          <p className="ajuda">
            Os movimentos não se alteram nem se apagam. Para corrigir um pagamento, peça um estorno: só produz efeito
            depois de aprovado por outra pessoa autorizada.
          </p>
          {d.movimentos.length === 0 ? (
            <p className="ajuda">Sem pagamentos.</p>
          ) : (
            <table className="tabela tabela-simples">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Movimento</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.movimentos.map((m) => (
                  <tr key={m.id}>
                    <td data-rotulo="Data">
                      {dataPt(m.data_efetiva)}
                      <small className="ajuda"> · registado {momentoPt(m.registado_em)}</small>
                    </td>
                    <td data-rotulo="Movimento">
                      {m.tipo_nome}
                      {m.meio_nome && ` · ${m.meio_nome}`}
                      {m.referencia_pagamento && ` · ${m.referencia_pagamento}`}
                      {m.motivo && <small className="ajuda"> · {m.motivo}</small>}
                      <small className="ajuda"> · {m.criado_por_nome}</small>
                    </td>
                    <td data-rotulo="Valor">
                      {m.tipo === 'estorno' ? `−${formatarEuros(m.valor)}` : formatarEuros(m.valor)}
                    </td>
                    <td data-rotulo="Estado">
                      {m.estado_nome}
                      {m.decidido_por_nome && <small className="ajuda"> · {m.decidido_por_nome}</small>}
                    </td>
                    <td>
                      {m.tipo === 'pagamento' && d.acoes.editar && Number(m.estornavel) > 0 && (
                        <button className="ligacao-botao" onClick={() => setDialogo({ estornar: m })}>
                          Estornar
                        </button>
                      )}
                      {m.tipo === 'estorno' &&
                        m.estado === 'pendente' &&
                        d.acoes.aprovar &&
                        m.criado_por_nome !== utilizador?.nome && (
                          <button className="ligacao-botao" onClick={() => setDialogo({ decidir: m })}>
                            Decidir
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bloco>
      )}

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <HistoricoRegisto
            chave={['documentos-consultor', d.id, 'historico']}
            obter={() => documentosApi.historico(d.id)}
            nomesCampos={NOMES_CAMPOS_DOCUMENTO}
          />
        )}
      </Bloco>

      {dialogo === 'pagamento' && <DialogoPagamento d={d} aoFechar={() => setDialogo(null)} aoGravar={atualizar} />}
      {dialogo && typeof dialogo === 'object' && 'estornar' in dialogo && (
        <DialogoEstorno d={d} m={dialogo.estornar} aoFechar={() => setDialogo(null)} aoGravar={atualizar} />
      )}
      {dialogo && typeof dialogo === 'object' && 'decidir' in dialogo && (
        <DialogoDecidir d={d} m={dialogo.decidir} aoFechar={() => setDialogo(null)} aoGravar={atualizar} />
      )}
      <Dialogo
        titulo="Eliminar documento"
        aberto={dialogo === 'eliminar'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>Use apenas se o documento foi registado por engano (ainda não tem pagamentos).</p>
      </Dialogo>
    </div>
  )
}

type PropsDialogo = { d: Documento; aoFechar: () => void; aoGravar: (d: Documento) => void }

function DialogoPagamento({ d, aoFechar, aoGravar }: PropsDialogo) {
  const opcoes = useQuery({
    queryKey: ['documentos-consultor', 'opcoes'],
    queryFn: documentosApi.opcoes,
    staleTime: 60_000,
  })
  const [v, setV] = useState({
    data_efetiva: hoje(),
    valor: String(Number(d.saldo.em_aberto)),
    meio: '',
    referencia: '',
  })
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const gravar = useMutation({
    mutationFn: () =>
      documentosApi.pagamento(d.id, {
        data_efetiva: v.data_efetiva,
        valor: v.valor.trim().replace(',', '.'),
        meio: v.meio ? Number(v.meio) : null,
        referencia_pagamento: v.referencia,
      }),
    onSuccess: aoGravar,
    onError: (e) => setErros(e instanceof ErroApi ? (e.campos as Record<string, string[]>) : {}),
  })
  return (
    <Dialogo
      titulo="Registar pagamento ao consultor"
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao-principal" disabled={gravar.isPending} onClick={() => gravar.mutate()}>
            Registar
          </button>
        </>
      }
    >
      <div className="formulario-dialogo">
        <p className="ajuda">
          Em falta: <strong>{formatarEuros(d.saldo.em_aberto)}</strong>. Pode registar um pagamento parcial.
        </p>
        <CampoTexto
          rotulo="Data do pagamento"
          type="date"
          value={v.data_efetiva}
          onChange={(e) => setV({ ...v, data_efetiva: e.target.value })}
          erro={erros.data_efetiva}
        />
        <CampoTexto
          rotulo="Valor (€)"
          inputMode="decimal"
          value={v.valor}
          onChange={(e) => setV({ ...v, valor: e.target.value })}
          erro={erros.valor}
        />
        <CampoSelecao
          rotulo="Meio de pagamento"
          vazio="—"
          value={v.meio}
          onChange={(e) => setV({ ...v, meio: e.target.value })}
          opcoes={(opcoes.data?.meios ?? []).map((x) => ({ valor: x.id, nome: x.nome }))}
        />
        <CampoTexto
          rotulo="Referência (opcional)"
          value={v.referencia}
          onChange={(e) => setV({ ...v, referencia: e.target.value })}
        />
      </div>
    </Dialogo>
  )
}

function DialogoEstorno({ d, m, aoFechar, aoGravar }: PropsDialogo & { m: Movimento }) {
  const [v, setV] = useState({ valor: String(Number(m.estornavel)), motivo: '', data_efetiva: hoje() })
  const [erro, setErro] = useState<string | null>(null)
  const gravar = useMutation({
    mutationFn: () =>
      documentosApi.estorno(d.id, {
        pagamento: m.id,
        valor: v.valor.trim().replace(',', '.'),
        motivo: v.motivo,
        data_efetiva: v.data_efetiva,
      }),
    onSuccess: aoGravar,
    onError: (e) => setErro(mensagem(e)),
  })
  return (
    <Dialogo
      titulo="Pedir estorno"
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            className="botao-principal"
            disabled={gravar.isPending || !v.motivo.trim()}
            onClick={() => gravar.mutate()}
          >
            Pedir estorno
          </button>
        </>
      }
    >
      <div className="formulario-dialogo">
        <p className="ajuda">
          Pagamento de {formatarEuros(m.valor)} em {dataPt(m.data_efetiva)}. Pode estornar até{' '}
          {formatarEuros(m.estornavel)}. O estorno só produz efeito depois de aprovado por outra pessoa.
        </p>
        <CampoTexto
          rotulo="Valor a estornar (€)"
          inputMode="decimal"
          value={v.valor}
          onChange={(e) => setV({ ...v, valor: e.target.value })}
        />
        <CampoTexto
          rotulo="Data"
          type="date"
          value={v.data_efetiva}
          onChange={(e) => setV({ ...v, data_efetiva: e.target.value })}
        />
        <CampoAreaTexto rotulo="Motivo" value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} />
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Dialogo>
  )
}

function DialogoDecidir({ d, m, aoFechar, aoGravar }: PropsDialogo & { m: Movimento }) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const decidir = useMutation({
    mutationFn: (aprovar: boolean) => documentosApi.decidirEstorno(d.id, m.id, { aprovar, motivo }),
    onSuccess: aoGravar,
    onError: (e) => setErro(mensagem(e)),
  })
  return (
    <Dialogo
      titulo="Decidir estorno"
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao-perigo" disabled={decidir.isPending} onClick={() => decidir.mutate(false)}>
            Recusar
          </button>
          <button className="botao-principal" disabled={decidir.isPending} onClick={() => decidir.mutate(true)}>
            Aprovar
          </button>
        </>
      }
    >
      <div className="formulario-dialogo">
        <p>
          {m.criado_por_nome} pede o estorno de <strong>{formatarEuros(m.valor)}</strong>.
        </p>
        <p className="ajuda">Motivo: {m.motivo}</p>
        <CampoAreaTexto
          rotulo="Observações da decisão (obrigatório para recusar)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Dialogo>
  )
}
