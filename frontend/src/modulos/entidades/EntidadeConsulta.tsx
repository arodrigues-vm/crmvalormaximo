import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { AcaoEmail, AcoesTelefone } from '../../componentes/AcoesContacto'
import { formatarTelefone } from '../../componentes/formatar'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { entidadesApi, NOMES_CAMPOS, type Entidade } from './api'

const dataPt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT') : null)
const momentoPt = (d: string) =>
  new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' })

const TIPOS_TEL: Record<string, string> = { movel: 'Telemóvel', fixo: 'Fixo', trabalho: 'Trabalho', outro: 'Outro' }
const CONSENT: Record<string, string> = {
  desconhecido: 'Desconhecido / não recolhido',
  concedido: 'Concedido',
  recusado: 'Recusado',
}

export function CabecalhoFicha({ e, acoes }: { e: Entidade; acoes?: React.ReactNode }) {
  return (
    <div className="cabecalho-ficha">
      <div>
        <p className="ficha-referencia">
          <Link to="/entidades">Entidades</Link> / {e.referencia}
        </p>
        <h2 className="ficha-titulo">
          {e.nome_completo}
          <span className={`etiqueta ${e.ativa ? 'etiqueta-sucesso' : 'etiqueta-neutra'}`}>
            {e.ativa ? 'Ativa' : 'Inativa'}
          </span>
        </h2>
      </div>
      <div className="ficha-acoes">{acoes}</div>
    </div>
  )
}

export function EntidadeConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const { data: e, error, isLoading } = useQuery({ queryKey: ['entidades', id], queryFn: () => entidadesApi.obter(id) })

  const eliminar = useMutation({
    mutationFn: () => entidadesApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entidades'] })
      navegar('/entidades', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Entidade não encontrada ou sem acesso.</p>
  if (!e) return <p className="erro">Não foi possível carregar a entidade.</p>

  const morada = [
    [e.rua, e.numero_policia].filter(Boolean).join(', '),
    e.complemento,
    [e.codigo_postal, e.localidade].filter(Boolean).join(' '),
  ].filter(Boolean)

  return (
    <div className="ficha">
      <CabecalhoFicha
        e={e}
        acoes={
          <>
            {e.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setConfirmarEliminar(true)}>
                Eliminar
              </button>
            )}
            {e.acoes.editar && (
              <Link to={`/entidades/${e.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <Bloco titulo="Identificação">
        <dl className="grelha-dados">
          <Dado rotulo="Tipo">{e.tipo_pessoa === 'singular' ? 'Pessoa singular' : 'Pessoa coletiva'}</Dado>
          <Dado rotulo={e.tipo_pessoa === 'singular' ? 'Nome' : 'Denominação'}>{e.nome}</Dado>
          {e.tipo_pessoa === 'singular' && <Dado rotulo="Apelido">{e.apelido}</Dado>}
          <Dado rotulo="NIF/NIPC">{e.nif && `${e.nif}${e.pais_fiscal !== 'PT' ? ` (${e.pais_fiscal})` : ''}`}</Dado>
          {e.tipo_pessoa === 'singular' && <Dado rotulo="Data de nascimento">{dataPt(e.data_nascimento)}</Dado>}
        </dl>
      </Bloco>

      <Bloco titulo="Contactos">
        <dl className="grelha-dados">
          <Dado rotulo="Telefones" largo>
            {e.telefones.length > 0 && (
              <ul className="lista-contactos">
                {e.telefones.map((t) => (
                  <li key={t.id}>
                    <span>
                      {formatarTelefone(t.numero_e164)}{' '}
                      <small className="ajuda">
                        {TIPOS_TEL[t.tipo]}
                        {t.principal && ' · principal'}
                      </small>
                    </span>
                    <AcoesTelefone e164={t.numero_e164} />
                  </li>
                ))}
              </ul>
            )}
          </Dado>
          <Dado rotulo="Email" largo>
            {e.email && (
              <span className="lista-contactos-linha">
                {e.email} <AcaoEmail email={e.email} />
              </span>
            )}
          </Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Morada">
        <dl className="grelha-dados">
          <Dado rotulo="Morada" largo>
            {morada.length > 0 && morada.map((l) => <div key={l}>{l}</div>)}
          </Dado>
          <Dado rotulo="Localização administrativa" largo>
            {e.localizacao && `${e.localizacao.freguesia}, ${e.localizacao.concelho}, ${e.localizacao.distrito}`}
          </Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Classificação">
        <dl className="grelha-dados">
          <Dado rotulo="Papéis">{e.papeis_nomes.join(', ')}</Dado>
          <Dado rotulo="Origem">{e.origem_nome}</Dado>
          <Dado rotulo="Responsável">{e.responsavel_nome}</Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Proteção de dados" abertoInicial={false} resumo={CONSENT[e.consentimento_marketing]}>
        <dl className="grelha-dados">
          <Dado rotulo="Consentimento de marketing">{CONSENT[e.consentimento_marketing]}</Dado>
          <Dado rotulo="Data do consentimento">{dataPt(e.consentimento_marketing_em)}</Dado>
          <Dado rotulo="Oposição a marketing">{e.oposicao_marketing ? 'Sim' : 'Não'}</Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!e.observacoes}>
        <p className="texto-livre">{e.observacoes || <span className="vazio">—</span>}</p>
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoEntidade id={e.id} />
            <p className="ajuda">
              Criada em {momentoPt(e.criado_em)} · última alteração em {momentoPt(e.atualizado_em)}
            </p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Eliminar entidade"
        aberto={confirmarEliminar}
        aoFechar={() => setConfirmarEliminar(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setConfirmarEliminar(false)}>
              Cancelar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>
          A entidade <strong>{e.nome_completo}</strong> será enviada para a lixeira. Pode ser restaurada por um
          utilizador autorizado.
        </p>
        {eliminar.isError && <p className="erro">Não foi possível eliminar.</p>}
      </Dialogo>
    </div>
  )
}

function HistoricoEntidade({ id }: { id: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['entidades', id, 'historico'],
    queryFn: () => entidadesApi.historico(id),
  })
  if (isLoading) return <p className="ajuda">A carregar…</p>
  if (!data?.length) return <p className="ajuda">Sem histórico.</p>
  return (
    <ol className="historico">
      {data.map((h, i) => (
        <li key={i}>
          <div className="historico-cabecalho">
            <strong>{h.tipo[0].toUpperCase() + h.tipo.slice(1)}</strong> · {momentoPt(h.momento)}
            {h.utilizador && ` · ${h.utilizador}`}
          </div>
          {h.alteracoes.length > 0 && (
            <ul>
              {h.alteracoes.map((a) => (
                <li key={a.campo}>
                  {NOMES_CAMPOS[a.campo] ?? a.campo}: <s>{a.antes || '—'}</s> → {a.depois || '—'}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}
