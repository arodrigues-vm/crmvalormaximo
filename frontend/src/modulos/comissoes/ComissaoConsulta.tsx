import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt as dataPtCurta, formatarEuros, formatarPercentagem, momentoPt } from '../../componentes/formatar'
import { comoRegistoCp } from '../../componentes/personalizados'
import {
  comissoesApi,
  NOMES_CAMPOS_COMISSAO,
  NOMES_LADO,
  type Comissao,
  type Excecao,
  type Lado,
  type Prestacao,
} from './api'
import { ECRA_COMISSAO } from './disposicao'

const euros = (v: string | null) => formatarEuros(v) ?? '—'

/** Tabela da repartição por lados: valor do lado, consultores e o que fica para a agência (D-48). */
export function TabelaReparticao({ c }: { c: Comissao }) {
  return (
    <table className="tabela tabela-simples">
      <thead>
        <tr>
          <th>Lado</th>
          <th>Valor do lado</th>
          <th>Consultores</th>
          <th>Fica para a agência</th>
        </tr>
      </thead>
      <tbody>
        {(['angariacao', 'venda'] as Lado[]).map((l) => {
          const r = c.resumo[l]
          const pct = l === 'angariacao' ? Number(c.pct_angariacao) : 100 - Number(c.pct_angariacao)
          return (
            <tr key={l}>
              <td data-rotulo="Lado">
                {NOMES_LADO[l]} <small className="ajuda">({pct.toLocaleString('pt-PT')} %)</small>
                {!r.nosso && <small className="ajuda"> · outra agência</small>}
              </td>
              <td data-rotulo="Valor do lado">{euros(r.valor)}</td>
              <td data-rotulo="Consultores">{r.nosso ? euros(r.consultores) : '—'}</td>
              <td data-rotulo="Agência">{r.nosso ? euros(r.agencia) : '—'}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <th>Total nosso</th>
          <td>{euros(c.resumo.total_nosso)}</td>
          <td />
          <td>{euros(c.resumo.total_agencia)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

export function ComissaoConsulta() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { utilizador } = useSessao()
  const [dialogo, setDialogo] = useState<null | 'excecao' | Excecao>(null)
  const {
    data: c,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['comissoes', id],
    queryFn: () => comissoesApi.obter(id),
  })
  const atualizar = (n: Comissao) => {
    qc.setQueryData(['comissoes', id], n)
    qc.invalidateQueries({ queryKey: ['comissoes', 'lista'] })
    qc.invalidateQueries({ queryKey: ['transacoes'] })
  }
  const recalcular = useMutation({ mutationFn: () => comissoesApi.recalcular(Number(id)), onSuccess: atualizar })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Comissão não encontrada ou sem acesso.</p>
  if (!c) return <p className="erro">Não foi possível carregar a comissão.</p>
  const co = c
  const pendente = c.excecoes.find((e) => e.estado === 'pendente')
  const arrendamento = c.operacao_categoria === 'arrendamento'

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'transacao':
        return (
          <Dado rotulo="Transação">
            <Link to={`/transacoes/${co.transacao}`}>{co.transacao_referencia}</Link>
            {co.transacao_estado && <small className="ajuda"> · {co.transacao_estado}</small>}
          </Dado>
        )
      case 'imovel':
        return <Dado rotulo="Imóvel">{co.imovel_descricao}</Dado>
      case 'comprador':
        return <Dado rotulo="Comprador">{co.comprador_nome ?? 'Entidade a que não tem acesso'}</Dado>
      case 'valor_final':
        return (
          <Dado rotulo="Comissão total (sem IVA)">
            {co.valor_final === null ? (
              <span className="etiqueta etiqueta-aviso">Por apurar</span>
            ) : (
              euros(co.valor_final)
            )}
          </Dado>
        )
      case 'iva':
        return (
          <Dado rotulo={`IVA${co.taxa_iva ? ` (${formatarPercentagem(co.taxa_iva)})` : ''}`}>
            {formatarEuros(co.iva)}
          </Dado>
        )
      case 'total_com_iva':
        return <Dado rotulo="Total com IVA">{formatarEuros(co.total_com_iva)}</Dado>
      case 'origem':
        return <Dado rotulo="Origem do valor">{co.origem_nome}</Dado>
      case 'responsavel':
        return <Dado rotulo="Responsável">{co.responsavel_nome}</Dado>
      case 'cmi':
        return (
          <Dado rotulo="CMI">
            {co.cmi_referencia ? `${co.cmi_referencia}${co.cmi_versao ? ` (versão ${co.cmi_versao})` : ''}` : 'Sem CMI'}
          </Dado>
        )
      case 'modalidade':
        return <Dado rotulo="Modalidade">{co.modalidade_nome}</Dado>
      case 'taxa_ou_valor':
        return (
          <Dado
            rotulo={
              co.modalidade === 'valor_fixo'
                ? 'Valor fixo'
                : co.modalidade === 'numero_rendas'
                  ? 'N.º de rendas'
                  : 'Taxa'
            }
          >
            {co.taxa_ou_valor === null
              ? null
              : co.modalidade === 'valor_fixo'
                ? formatarEuros(co.taxa_ou_valor)
                : co.modalidade === 'numero_rendas'
                  ? Number(co.taxa_ou_valor).toLocaleString('pt-PT')
                  : formatarPercentagem(co.taxa_ou_valor)}
          </Dado>
        )
      case 'base_negocio':
        return <Dado rotulo={arrendamento ? 'Renda mensal' : 'Valor do negócio'}>{formatarEuros(co.base_negocio)}</Dado>
      case 'minimo':
        return <Dado rotulo="Remuneração mínima">{formatarEuros(co.minimo)}</Dado>
      case 'taxa_iva':
        return (
          <Dado rotulo="IVA no CMI">
            {co.taxa_iva === null
              ? null
              : `${formatarPercentagem(co.taxa_iva)} · ${co.inclui_iva ? 'valores com IVA incluído' : 'acresce IVA'}`}
          </Dado>
        )
      case 'valor_calculado':
        return (
          <Dado rotulo="Comissão calculada (sem IVA)">{formatarEuros(co.valor_calculado) ?? 'Não calculável'}</Dado>
        )
      case 'pct_angariacao':
        return (
          <Dado rotulo="Repartição">
            Angariação {formatarPercentagem(co.pct_angariacao)} · Venda{' '}
            {formatarPercentagem(String(100 - Number(co.pct_angariacao)))}
          </Dado>
        )
      case 'lados':
        return (
          <Largo>
            <TabelaReparticao c={co} />
          </Largo>
        )
      case 'beneficiarios':
        return (
          <Largo>
            {co.beneficiarios.length === 0 ? (
              <p className="ajuda">Sem consultores indicados.</p>
            ) : (
              <ul className="lista-relacoes">
                {co.beneficiarios.map((b) => (
                  <li key={b.id}>
                    <strong>{b.utilizador_nome}</strong>
                    <span className="relacao-tipo">{NOMES_LADO[b.lado]}</span>
                    <span>
                      {b.modo === 'percentagem'
                        ? `${formatarPercentagem(b.percentagem)} do lado`
                        : b.modo === 'deducao'
                          ? `lado menos ${formatarEuros(b.deducao)}`
                          : 'forma de cálculo por indicar'}
                    </span>
                    <strong>{euros(b.valor ?? null)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </Largo>
        )
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {co.observacoes && <span className="texto-livre">{co.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Faturação e Comissões"
        caminho="/faturacao"
        referencia={c.referencia}
        titulo={`Comissão · ${c.transacao_referencia}`}
        etiqueta={pendente ? { texto: 'Exceção pendente', tipo: 'aviso' } : undefined}
        acoes={
          <>
            {c.acoes.editar && c.valor_calculado !== null && !pendente && (
              <button className="botao-secundario" onClick={() => setDialogo('excecao')}>
                Pedir exceção ao valor
              </button>
            )}
            {c.acoes.editar && !pendente && (
              <button className="botao-secundario" disabled={recalcular.isPending} onClick={() => recalcular.mutate()}>
                Recalcular
              </button>
            )}
            {c.acoes.editar && (
              <Link to={`/faturacao/comissoes/${c.id}/editar`} className="botao-principal">
                Editar repartição
              </Link>
            )}
          </>
        }
      />
      {recalcular.error && (
        <p className="erro" role="alert">
          {recalcular.error instanceof ErroApi ? recalcular.error.message : 'Não foi possível recalcular.'}
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_COMISSAO}
        modo="ver"
        registo={comoRegistoCp(c)}
        campo={desenharCampo}
        abertoInicial={(b) =>
          b.chave === 'observacoes' ? !!c.observacoes : b.chave !== 'base' || c.valor_final === null
        }
      />

      <Bloco titulo="Pagamentos aos consultores">
        <PagamentosConsultores c={c} aoAtualizar={atualizar} />
      </Bloco>

      <Bloco titulo="Exceções ao valor" resumo={c.excecoes.length ? `${c.excecoes.length}` : undefined}>
        {c.excecoes.length === 0 ? (
          <p className="ajuda">
            Sem exceções. Para mudar um valor calculado peça uma exceção: fica pendente até ser aprovada por outra
            pessoa autorizada.
          </p>
        ) : (
          <ul className="historico">
            {c.excecoes.map((e) => (
              <li key={e.id}>
                <div className="historico-cabecalho">
                  <strong>
                    {euros(e.valor_original)} → {euros(e.valor_proposto)}
                  </strong>{' '}
                  <span
                    className={`etiqueta etiqueta-${e.estado === 'aprovada' ? 'sucesso' : e.estado === 'recusada' ? 'perigo' : 'aviso'}`}
                  >
                    {e.estado_nome}
                  </span>
                </div>
                <small>
                  Pedida por {e.requerente_nome} em {momentoPt(e.criado_em)} · Motivo: {e.motivo}
                </small>
                {e.decidido_por_nome && (
                  <small>
                    <br />
                    Decidida por {e.decidido_por_nome} em {momentoPt(e.decidido_em!)}
                    {e.motivo_decisao && ` · ${e.motivo_decisao}`}
                  </small>
                )}
                {e.estado === 'pendente' && c.acoes.aprovar && e.requerente_nome !== utilizador?.nome && (
                  <div className="acoes-bloco">
                    <button className="botao-principal" onClick={() => setDialogo(e)}>
                      Decidir
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['comissoes', c.id, 'historico']}
              obter={() => comissoesApi.historico(c.id)}
              nomesCampos={NOMES_CAMPOS_COMISSAO}
            />
            <p className="ajuda">Apurada em {momentoPt(c.criado_em)}</p>
          </>
        )}
      </Bloco>

      {dialogo === 'excecao' && (
        <DialogoPedido c={c} aoFechar={() => setDialogo(null)} aoGravar={(n) => (atualizar(n), setDialogo(null))} />
      )}
      {dialogo && dialogo !== 'excecao' && (
        <DialogoDecisao
          c={c}
          e={dialogo}
          aoFechar={() => setDialogo(null)}
          aoGravar={(n) => (atualizar(n), setDialogo(null))}
        />
      )}
    </div>
  )
}

function DialogoPedido({
  c,
  aoFechar,
  aoGravar,
}: {
  c: Comissao
  aoFechar: () => void
  aoGravar: (c: Comissao) => void
}) {
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const pedir = useMutation({
    mutationFn: () => comissoesApi.pedirExcecao(c.id, { valor_proposto: valor.trim().replace(',', '.'), motivo }),
    onSuccess: aoGravar,
    onError: (e) => setErros(e instanceof ErroApi ? (e.campos as Record<string, string[]>) : {}),
  })
  return (
    <Dialogo
      titulo="Pedir exceção ao valor da comissão"
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            className="botao-principal"
            disabled={pedir.isPending || !valor || !motivo.trim()}
            onClick={() => pedir.mutate()}
          >
            Enviar pedido
          </button>
        </>
      }
    >
      <div className="formulario-dialogo">
        <p className="ajuda">
          Valor atual: <strong>{euros(c.valor_final)}</strong> (calculado: {euros(c.valor_calculado)}). O novo valor só
          fica em vigor depois de aprovado por outra pessoa autorizada.
        </p>
        <CampoTexto
          rotulo="Valor proposto (€, sem IVA)"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          erro={erros.valor_proposto}
        />
        <CampoAreaTexto
          rotulo="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          erro={erros.motivo}
        />
        {erros.detail && <p className="erro">{String(erros.detail)}</p>}
      </div>
    </Dialogo>
  )
}

function DialogoDecisao({
  c,
  e,
  aoFechar,
  aoGravar,
}: {
  c: Comissao
  e: Excecao
  aoFechar: () => void
  aoGravar: (c: Comissao) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const decidir = useMutation({
    mutationFn: (aprovar: boolean) => comissoesApi.decidirExcecao(c.id, e.id, { aprovar, motivo }),
    onSuccess: aoGravar,
    onError: (x) =>
      setErro(
        x instanceof ErroApi ? Object.values(x.campos).flat().join(' ') || x.message : 'Não foi possível gravar.',
      ),
  })
  return (
    <Dialogo
      titulo="Decidir exceção"
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
          {e.requerente_nome} pede para mudar a comissão de <strong>{euros(e.valor_original)}</strong> para{' '}
          <strong>{euros(e.valor_proposto)}</strong>.
        </p>
        <p className="ajuda">Motivo: {e.motivo}</p>
        <CampoAreaTexto
          rotulo="Observações da decisão (obrigatório para recusar)"
          value={motivo}
          onChange={(x) => setMotivo(x.target.value)}
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

/** D-49: por consultor, quanto recebe, quanto faturou à agência, quanto foi pago e as prestações. */
function PagamentosConsultores({ c, aoAtualizar }: { c: Comissao; aoAtualizar: (c: Comissao) => void }) {
  const [proposta, setProposta] = useState<Prestacao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const propor = useMutation({
    mutationFn: () => comissoesApi.propostaPrestacoes(c.id),
    onSuccess: (p) => setProposta(p),
  })
  const gravar = useMutation({
    mutationFn: () => comissoesApi.gravarPrestacoes(c.id, proposta ?? []),
    onSuccess: (n) => {
      aoAtualizar(n)
      setProposta(null)
    },
    onError: (e) => setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falhou.'),
  })
  if (c.pagamentos_consultores.length === 0)
    return <p className="ajuda">Sem consultores nesta comissão (indique-os em «Editar repartição»).</p>
  return (
    <>
      <table className="tabela tabela-simples">
        <thead>
          <tr>
            <th>Consultor</th>
            <th>Recebe da comissão (sem IVA)</th>
            <th>Faturado à agência (com IVA, menos retenção)</th>
            <th>Pago</th>
            <th>Por pagar</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {c.pagamentos_consultores.map((p) => (
            <tr key={p.utilizador}>
              <td data-rotulo="Consultor">{p.utilizador_nome}</td>
              <td data-rotulo="Recebe">{euros(p.a_receber)}</td>
              <td data-rotulo="Faturado">{euros(p.faturado)}</td>
              <td data-rotulo="Pago">{euros(p.pago)}</td>
              <td data-rotulo="Por pagar">
                <strong>{euros(p.por_pagar)}</strong>
              </td>
              <td>
                {c.acoes.editar && (
                  <Link
                    to={`/faturacao/documentos/novo?comissao=${c.id}&consultor=${p.utilizador}`}
                    className="ligacao-botao"
                  >
                    Registar documento
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <Link to={`/faturacao/documentos?comissao=${c.id}`}>Ver os documentos e pagamentos desta comissão</Link>
      </p>
      <h4 className="subtitulo-bloco">Prestações</h4>
      {c.prestacoes.length === 0 ? (
        <p className="ajuda">Sem prestações definidas.</p>
      ) : (
        <ul className="lista-relacoes">
          {c.prestacoes.map((p) => (
            <li key={p.id}>
              <strong>{p.utilizador_nome}</strong>
              <span className="relacao-tipo">{p.momento_nome}</span>
              <span>{euros(p.valor)}</span>
              {p.data_prevista && <small className="ajuda">prevista {dataPtCurta(p.data_prevista)}</small>}
              {c.acoes.editar && (
                <Link
                  to={`/faturacao/documentos/novo?comissao=${c.id}&consultor=${p.utilizador}&prestacao=${p.id}&valor=${Number(p.valor)}`}
                  className="ligacao-botao"
                >
                  Registar documento
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {c.acoes.editar && (
        <div className="acoes-bloco">
          <button className="botao-secundario" disabled={propor.isPending} onClick={() => propor.mutate()}>
            {c.prestacoes.length ? 'Propor de novo as prestações' : 'Propor prestações'}
          </button>
        </div>
      )}
      {proposta && (
        <Dialogo
          titulo="Prestações propostas"
          aberto
          aoFechar={() => setProposta(null)}
          acoes={
            <>
              <button className="botao-secundario" onClick={() => setProposta(null)}>
                Cancelar
              </button>
              <button className="botao-principal" disabled={gravar.isPending} onClick={() => gravar.mutate()}>
                Confirmar
              </button>
            </>
          }
        >
          <div className="formulario-dialogo">
            <p className="ajuda">
              Calculadas segundo o momento de pagamento do CMI. Pode ajustar os valores antes de confirmar.
              {c.prestacoes.length > 0 && ' As prestações atuais são substituídas.'}
            </p>
            {proposta.map((p, i) => (
              <CampoTexto
                key={i}
                rotulo={`${p.utilizador_nome} · ${p.momento === 'cpcv' ? 'No CPCV' : 'Na escritura / contrato'} (€)`}
                inputMode="decimal"
                value={p.valor}
                onChange={(e) =>
                  setProposta(proposta.map((x, j) => (j === i ? { ...x, valor: e.target.value.replace(',', '.') } : x)))
                }
              />
            ))}
            {erro && (
              <p className="erro" role="alert">
                {erro}
              </p>
            )}
          </div>
        </Dialogo>
      )}
    </>
  )
}
