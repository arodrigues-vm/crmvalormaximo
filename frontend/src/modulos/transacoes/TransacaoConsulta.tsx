import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi, pedido } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis, Largo } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, CampoSelecao, CampoTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, formatarEuros, formatarPercentagem, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { LigacoesExternas } from '../../componentes/LigacoesExternas'
import { comoRegistoCp } from '../../componentes/personalizados'
import { ETIQUETA_TRANSACAO, NOMES_CAMPOS_TRANSACAO, SO_VENDA, transacoesApi, type Transacao } from './api'
import { ECRA_TRANSACAO } from './disposicao'

export function TransacaoConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [dialogo, setDialogo] = useState<null | 'estado' | 'eliminar'>(null)
  const {
    data: x,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['transacoes', id],
    queryFn: () => transacoesApi.obter(id),
  })
  const opcoes = useQuery({ queryKey: ['transacoes', 'opcoes'], queryFn: transacoesApi.opcoes, staleTime: 60_000 })
  const tiposLigacao = useQuery({
    queryKey: ['listas', 'tipos_ligacao', 'opcoes'],
    queryFn: async () =>
      (await pedido<{ chave: string; valores: { id: number; nome: string; ativo: boolean }[] }[]>('/api/listas/'))
        .find((l) => l.chave === 'tipos_ligacao')
        ?.valores.filter((v) => v.ativo) ?? [],
    staleTime: 60_000,
  })
  const eliminar = useMutation({
    mutationFn: () => transacoesApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transacoes'] })
      qc.invalidateQueries({ queryKey: ['propostas'] })
      navegar('/transacoes', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Transação não encontrada ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar a transação.</p>
  const tr = x
  const arrendamento = x.operacao_categoria === 'arrendamento'
  const sinal =
    x.sinal_valor === null
      ? null
      : x.sinal_unidade === 'euros'
        ? formatarEuros(x.sinal_valor)
        : formatarPercentagem(x.sinal_valor)

  function desenharCampo(c: string): ReactNode {
    switch (c) {
      case 'proposta':
        return (
          <Dado rotulo="Proposta de origem">
            <Link to={`/propostas/${tr.proposta}`}>{tr.proposta_referencia}</Link>
          </Dado>
        )
      case 'imovel':
        return (
          <Dado rotulo="Imóvel">
            {tr.imovel ? (
              <Link to={`/imoveis/${tr.imovel}`}>{tr.imovel_descricao_completa}</Link>
            ) : (
              <>
                {tr.imovel_descricao_completa} <small className="ajuda">(não registado no CRM)</small>
              </>
            )}
          </Dado>
        )
      case 'entidade':
        return (
          <Dado rotulo="Comprador">
            {tr.entidade_nome ? (
              <Link to={`/entidades/${tr.entidade}`}>{tr.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
        )
      case 'operacao':
        return <Dado rotulo="Operação">{tr.operacao_nome}</Dado>
      case 'angariacao':
        return (
          <Dado rotulo="CMI">
            {tr.angariacao ? <Link to={`/angariacoes/${tr.angariacao}`}>{tr.angariacao_descricao}</Link> : 'Sem CMI'}
          </Dado>
        )
      case 'valor':
        return <Dado rotulo="Valor acordado">{formatarEuros(tr.valor)}</Dado>
      case 'sinal':
        return <Dado rotulo="Sinal">{sinal}</Dado>
      case 'estado':
        return (
          <Dado rotulo="Estado">
            {tr.estado_nome}
            {tr.motivo_estado && <small className="ajuda"> — {tr.motivo_estado}</small>}
          </Dado>
        )
      case 'responsavel_imovel':
        return <Dado rotulo="Responsável pelo imóvel">{tr.responsavel_imovel_nome}</Dado>
      case 'responsavel_comprador':
        return <Dado rotulo="Responsável pela entidade">{tr.responsavel_comprador_nome}</Dado>
      case 'responsavel':
        return <Dado rotulo="Responsável">{tr.responsavel_nome}</Dado>
      case 'data_cpcv_prevista':
        return arrendamento ? null : <Dado rotulo="Data prevista do CPCV">{dataPt(tr.data_cpcv_prevista)}</Dado>
      case 'data_cpcv':
        return arrendamento ? null : <Dado rotulo="Data do CPCV">{dataPt(tr.data_cpcv)}</Dado>
      case 'data_escritura_prevista':
        return (
          <Dado rotulo={arrendamento ? 'Data prevista do contrato' : 'Data prevista da escritura'}>
            {dataPt(tr.data_escritura_prevista)}
          </Dado>
        )
      case 'data_escritura':
        return <Dado rotulo={arrendamento ? 'Data do contrato' : 'Data da escritura'}>{dataPt(tr.data_escritura)}</Dado>
      case 'participantes':
        return (
          <Largo>
            <ul className="lista-relacoes">
              {tr.participantes_detalhe.map((p) => (
                <li key={p.entidade}>
                  {p.acessivel ? (
                    <Link to={`/entidades/${p.entidade}`}>{p.nome}</Link>
                  ) : (
                    <span className="vazio">{p.nome}</span>
                  )}
                  <span className="relacao-tipo">
                    {p.papel_nome ?? 'Papel não indicado'}
                    {p.quota && ` · ${formatarPercentagem(p.quota)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Largo>
        )
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {tr.observacoes && <span className="texto-livre">{tr.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Transações"
        caminho="/transacoes"
        referencia={x.referencia}
        titulo={`${x.entidade_nome ?? 'Comprador'} · ${x.imovel_descricao_completa}`}
        etiqueta={
          x.estado_nome
            ? { texto: x.estado_nome, tipo: ETIQUETA_TRANSACAO[x.estado_categoria ?? ''] ?? 'neutra' }
            : undefined
        }
        acoes={
          <>
            {x.acoes.eliminar && x.estado_categoria !== 'concluida' && (
              <button className="botao-secundario" onClick={() => setDialogo('eliminar')}>
                Eliminar
              </button>
            )}
            {x.acoes.editar && (
              <button className="botao-secundario" onClick={() => setDialogo('estado')}>
                Mudar estado
              </button>
            )}
            {x.acoes.editar && (
              <Link to={`/transacoes/${x.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <BlocosConfiguraveis
        def={ECRA_TRANSACAO}
        modo="ver"
        registo={comoRegistoCp(x)}
        campo={desenharCampo}
        abertoInicial={(b) => (b.chave === 'observacoes' ? !!x.observacoes : true)}
      />

      {x.efeitos_aplicados.length > 0 && (
        <Bloco titulo="Alterações feitas a outros registos" abertoInicial={false}>
          <ul className="historico">
            {x.efeitos_aplicados.map((e, i) => (
              <li key={i}>
                <div className="historico-cabecalho">
                  {e.descricao} {e.revertido && <span className="etiqueta etiqueta-neutra">desfeita</span>}
                </div>
                <small>
                  {momentoPt(e.em)} · {e.por}
                </small>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      <Bloco titulo="Documentos e ligações">
        <LigacoesExternas
          base={`/api/transacoes/${x.id}/ligacoes/`}
          podeEditar={x.acoes.editar}
          tipos={tiposLigacao.data ?? []}
        />
      </Bloco>

      <Bloco titulo="Contactos registados" abertoInicial={false}>
        <Interacoes
          base={`/api/transacoes/${x.id}/interacoes/`}
          podeEditar={x.acoes.editar}
          tipos={opcoes.data?.tipos_interacao ?? []}
        />
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['transacoes', x.id, 'historico']}
              obter={() => transacoesApi.historico(x.id)}
              nomesCampos={NOMES_CAMPOS_TRANSACAO}
            />
            <p className="ajuda">Criada em {momentoPt(x.criado_em)}</p>
          </>
        )}
      </Bloco>

      {dialogo === 'estado' && (
        <DialogoEstado
          t={x}
          estados={opcoes.data?.estados ?? []}
          aoFechar={() => setDialogo(null)}
          aoGravar={(n) => {
            qc.setQueryData(['transacoes', id], n)
            qc.invalidateQueries({ queryKey: ['transacoes', 'lista'] })
            qc.invalidateQueries({ queryKey: ['imoveis'] })
            qc.invalidateQueries({ queryKey: ['angariacoes'] })
            setDialogo(null)
          }}
        />
      )}

      <Dialogo
        titulo="Eliminar transação"
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
        <p>Se o negócio não avançou, prefira mudar o estado para «Cancelada».</p>
        {eliminar.error && (
          <p className="erro" role="alert">
            {eliminar.error instanceof ErroApi ? eliminar.error.message : 'Não foi possível eliminar.'}
          </p>
        )}
      </Dialogo>
    </div>
  )
}

/** Mudar estado (F3-06): mostra as alterações propostas a outros registos e só aplica as confirmadas. */
function DialogoEstado({
  t,
  estados,
  aoFechar,
  aoGravar,
}: {
  t: Transacao
  estados: { id: number; nome: string; categoria?: string }[]
  aoFechar: () => void
  aoGravar: (t: Transacao) => void
}) {
  const arrendamento = t.operacao_categoria === 'arrendamento'
  const possiveis = estados.filter((e) => e.id !== t.estado && !(arrendamento && SO_VENDA.includes(e.categoria ?? '')))
  const [estado, setEstado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [datas, setDatas] = useState({
    data_cpcv: t.data_cpcv ?? '',
    data_escritura_prevista: t.data_escritura_prevista ?? '',
    data_escritura: t.data_escritura ?? '',
  })
  const [escolhidos, setEscolhidos] = useState<string[] | null>(null)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const categoria = estados.find((e) => String(e.id) === estado)?.categoria
  const final = t.estado_categoria === 'concluida' || t.estado_categoria === 'cancelada'
  const pedeMotivo = categoria === 'cancelada' || (final && categoria !== 'concluida' && categoria !== 'cancelada')
  const efeitos = useQuery({
    queryKey: ['transacoes', t.id, 'efeitos', estado],
    queryFn: () => transacoesApi.efeitos(t.id, estado),
    enabled: !!estado,
  })
  // Por omissão, todos os efeitos propostos vêm marcados; o utilizador pode desmarcar.
  const marcados = escolhidos ?? (efeitos.data ?? []).map((e) => e.chave)
  const gravar = useMutation({
    mutationFn: () =>
      transacoesApi.mudarEstado(t.id, {
        estado: Number(estado),
        motivo,
        efeitos: marcados,
        ...(categoria === 'cpcv' ? { data_cpcv: datas.data_cpcv || null } : {}),
        ...(categoria === 'escritura' ? { data_escritura_prevista: datas.data_escritura_prevista || null } : {}),
        ...(categoria === 'concluida' ? { data_escritura: datas.data_escritura || null } : {}),
      }),
    onSuccess: aoGravar,
    onError: (e) => setErros(e instanceof ErroApi ? (e.campos as Record<string, string[]>) : {}),
  })
  return (
    <Dialogo
      titulo="Mudar estado da transação"
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            className="botao-principal"
            disabled={!estado || gravar.isPending || efeitos.isFetching}
            onClick={() => gravar.mutate()}
          >
            Confirmar
          </button>
        </>
      }
    >
      <div className="formulario-dialogo">
        <p className="ajuda">
          Estado atual: <strong>{t.estado_nome}</strong>
        </p>
        <CampoSelecao
          rotulo="Novo estado"
          vazio="—"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value)
            setEscolhidos(null)
            setErros({})
          }}
          opcoes={possiveis.map((e) => ({ valor: e.id, nome: e.nome }))}
          erro={erros.estado}
        />
        {categoria === 'cpcv' && (
          <CampoTexto
            rotulo="Data em que o CPCV foi assinado"
            type="date"
            value={datas.data_cpcv}
            onChange={(e) => setDatas((d) => ({ ...d, data_cpcv: e.target.value }))}
            erro={erros.data_cpcv}
          />
        )}
        {categoria === 'escritura' && (
          <CampoTexto
            rotulo="Data marcada para a escritura"
            type="date"
            value={datas.data_escritura_prevista}
            onChange={(e) => setDatas((d) => ({ ...d, data_escritura_prevista: e.target.value }))}
            erro={erros.data_escritura_prevista}
          />
        )}
        {categoria === 'concluida' && (
          <CampoTexto
            rotulo={arrendamento ? 'Data em que o contrato foi assinado' : 'Data da escritura'}
            type="date"
            value={datas.data_escritura}
            onChange={(e) => setDatas((d) => ({ ...d, data_escritura: e.target.value }))}
            erro={erros.data_escritura}
          />
        )}
        {(pedeMotivo || categoria === 'cancelada') && (
          <CampoAreaTexto
            rotulo={categoria === 'cancelada' ? 'Motivo do cancelamento' : 'Motivo para reabrir'}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            erro={erros.motivo}
          />
        )}
        {estado && efeitos.data && efeitos.data.length > 0 && (
          <fieldset className="efeitos-propostos">
            <legend>Alterações propostas a outros registos (só se aplicam as marcadas)</legend>
            {efeitos.data.map((e) => (
              <label key={e.chave} className="efeito-opcao">
                <input
                  type="checkbox"
                  checked={marcados.includes(e.chave)}
                  onChange={(ev) =>
                    setEscolhidos(ev.target.checked ? [...marcados, e.chave] : marcados.filter((k) => k !== e.chave))
                  }
                />
                {e.descricao}
              </label>
            ))}
          </fieldset>
        )}
        {estado && efeitos.data?.length === 0 && <p className="ajuda">Esta mudança não altera outros registos.</p>}
        {erros.efeitos && (
          <p className="erro" role="alert">
            {erros.efeitos.join(' ')}
          </p>
        )}
        {erros.detail && (
          <p className="erro" role="alert">
            {String(erros.detail)}
          </p>
        )}
      </div>
    </Dialogo>
  )
}
