import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { AcaoEmail, AcoesTelefone } from '../../componentes/AcoesContacto'
import { formatarTelefone } from '../../componentes/formatar'
import { Bloco } from '../../componentes/Bloco'
import { comoRegistoCp } from '../../componentes/personalizados'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { entidadesApi, NOMES_CAMPOS, type Entidade, type RegistoLigado } from './api'
import { ImoveisDaEntidade } from './ImoveisDaEntidade'
import { NegociosDaEntidade } from './NegociosDaEntidade'
import { useSessao } from '../../app/sessao'
import { RelacoesEntidade } from './RelacoesEntidade'
import { ECRA_ENTIDADE, SO_SINGULAR } from './disposicao'
import { VisitasDoRegisto } from '../visitas/VisitasDoRegisto'

const dataPt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT') : null)
const momentoPt = (d: string) =>
  new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' })

const TIPOS_TEL: Record<string, string> = { movel: 'Telemóvel', fixo: 'Fixo', trabalho: 'Trabalho', outro: 'Outro' }
const CONSENT: Record<string, string> = {
  desconhecido: 'Desconhecido / não recolhido',
  concedido: 'Concedido',
  recusado: 'Recusado',
}

function Ligado({ d, caminho }: { d: RegistoLigado | null; caminho: string }) {
  if (!d) return null
  if (!d.acessivel) return <span className="vazio">{d.nome}</span>
  return (
    <Link to={`${caminho}/${d.id}`}>
      {d.referencia} · {d.nome}
    </Link>
  )
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
          {e.status_nome && (
            <span className={`etiqueta ${e.status_categoria === 'ativo' ? 'etiqueta-sucesso' : 'etiqueta-neutra'}`}>
              {e.status_nome}
            </span>
          )}
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
  const opcoes = useQuery({ queryKey: ['entidades', 'opcoes'], queryFn: entidadesApi.opcoes, staleTime: 60_000 })
  const { pode } = useSessao()

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

  const singular = e.tipo_pessoa === 'singular'
  const ent = e
  function desenharCampo(c: string): ReactNode {
    if (!singular && SO_SINGULAR.has(c)) return null
    switch (c) {
      case 'tipo_pessoa':
        return <Dado rotulo="Tipo">{singular ? 'Pessoa singular' : 'Pessoa coletiva'}</Dado>
      case 'nome':
        return <Dado rotulo={singular ? 'Nome' : 'Denominação'}>{ent.nome}</Dado>
      case 'apelido':
        return <Dado rotulo="Apelido">{ent.apelido}</Dado>
      case 'nif':
        return <Dado rotulo={singular ? 'NIF' : 'NIPC'}>{ent.nif}</Dado>
      case 'pais_fiscal':
        return <Dado rotulo="País fiscal">{ent.pais_fiscal}</Dado>
      case 'telefones':
        return (
          <Dado rotulo="Telefones" largo>
            {ent.telefones.length > 0 && (
              <ul className="lista-contactos">
                {ent.telefones.map((t) => (
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
        )
      case 'email':
        return (
          <Dado rotulo="Email" largo>
            {ent.email && (
              <span className="lista-contactos-linha">
                {ent.email} <AcaoEmail email={ent.email} />
              </span>
            )}
          </Dado>
        )
      case 'rua':
        return <Dado rotulo="Rua">{ent.rua}</Dado>
      case 'numero_policia':
        return <Dado rotulo="N.º de polícia">{ent.numero_policia}</Dado>
      case 'complemento':
        return <Dado rotulo="Complemento">{ent.complemento}</Dado>
      case 'codigo_postal':
        return <Dado rotulo="Código postal">{ent.codigo_postal}</Dado>
      case 'localidade':
        return <Dado rotulo="Localidade">{ent.localidade}</Dado>
      case 'freguesia':
        return (
          <Dado rotulo="Localização administrativa" largo>
            {ent.localizacao &&
              `${ent.localizacao.freguesia}, ${ent.localizacao.concelho}, ${ent.localizacao.distrito}`}
          </Dado>
        )
      case 'zona_comercial':
        return <Dado rotulo="Zona">{ent.nomes.zona_comercial}</Dado>
      case 'data_nascimento':
        return <Dado rotulo="Data de nascimento">{dataPt(ent.data_nascimento)}</Dado>
      case 'estado_civil':
        return <Dado rotulo="Estado civil">{ent.nomes.estado_civil}</Dado>
      case 'regime_casamento':
        return <Dado rotulo="Regime de casamento">{ent.nomes.regime_casamento}</Dado>
      case 'nacionalidade':
        return <Dado rotulo="Nacionalidade">{ent.nacionalidade}</Dado>
      case 'documento_identificacao':
        return <Dado rotulo="CC/Passaporte">{ent.documento_identificacao}</Dado>
      case 'naturalidade_freguesia':
        return <Dado rotulo="Freguesia de naturalidade">{ent.naturalidade_freguesia}</Dado>
      case 'naturalidade_concelho':
        return <Dado rotulo="Concelho de naturalidade">{ent.naturalidade_concelho}</Dado>
      case 'empresa':
        return <Dado rotulo="Empresa">{ent.empresa}</Dado>
      case 'cargo':
        return <Dado rotulo="Cargo">{ent.cargo}</Dado>
      case 'observacoes_pessoais':
        return (
          <Dado rotulo="Observações (dados pessoais)" largo>
            {ent.observacoes_pessoais && <span className="texto-livre">{ent.observacoes_pessoais}</span>}
          </Dado>
        )
      case 'papeis':
        return <Dado rotulo="Tipo de cliente">{ent.papeis_nomes.join(', ')}</Dado>
      case 'status':
        return <Dado rotulo="Status">{ent.status_nome}</Dado>
      case 'origem':
        return <Dado rotulo="Origem do contacto">{ent.origem_nome}</Dado>
      case 'responsavel':
        return <Dado rotulo="Responsável">{ent.responsavel_nome}</Dado>
      case 'quem_recomendou':
        return (
          <Dado rotulo="Quem recomendou">
            {ent.quem_recomendou_dados && <Ligado d={ent.quem_recomendou_dados} caminho="/entidades" />}
          </Dado>
        )
      case 'imovel_contacto':
        return (
          <Dado rotulo="Imóvel de contacto">
            {ent.imovel_contacto_dados && <Ligado d={ent.imovel_contacto_dados} caminho="/imoveis" />}
          </Dado>
        )
      case 'visitou_imovel_contacto':
        return (
          <Dado rotulo="Visitou o imóvel de contacto">
            {ent.visitou_imovel_contacto === null ? null : ent.visitou_imovel_contacto ? 'Sim' : 'Não'}
          </Dado>
        )
      case 'motivo_nao_visitou':
        return ent.visitou_imovel_contacto === false ? (
          <Dado rotulo="Porque não visitou" largo>
            {ent.motivo_nao_visitou && <span className="texto-livre">{ent.motivo_nao_visitou}</span>}
          </Dado>
        ) : null
      case 'consentimento_marketing':
        return <Dado rotulo="Consentimento de marketing">{CONSENT[ent.consentimento_marketing]}</Dado>
      case 'consentimento_marketing_em':
        return <Dado rotulo="Data do consentimento">{dataPt(ent.consentimento_marketing_em)}</Dado>
      case 'oposicao_marketing':
        return <Dado rotulo="Oposição a marketing">{ent.oposicao_marketing ? 'Sim' : 'Não'}</Dado>
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {ent.observacoes && <span className="texto-livre">{ent.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

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

      <BlocosConfiguraveis
        def={ECRA_ENTIDADE}
        modo="ver"
        registo={comoRegistoCp(e)}
        campo={desenharCampo}
        abertoInicial={(b) => (b.chave === 'dados' ? false : b.chave === 'observacoes' ? !!e.observacoes : true)}
        resumo={(b) => (b.chave === 'dados' ? CONSENT[e.consentimento_marketing] : null)}
      />

      <Bloco titulo="Imóveis (proprietária)">
        <ImoveisDaEntidade entidadeId={e.id} />
      </Bloco>

      {(pode('oportunidades') || pode('procuras')) && (
        <Bloco titulo="Oportunidades e procuras">
          <NegociosDaEntidade entidadeId={e.id} podeOport={pode('oportunidades')} podeProc={pode('procuras')} />
        </Bloco>
      )}

      {pode('visitas') && (
        <Bloco titulo="Visitas e interesses" abertoInicial={false}>
          {() => <VisitasDoRegisto filtro={{ entidade: e.id }} podeCriar={pode('visitas', 'criar')} />}
        </Bloco>
      )}

      <Bloco titulo="Entidades relacionadas">
        <RelacoesEntidade entidadeId={e.id} podeEditar={e.acoes.editar} tipos={opcoes.data?.tipos_relacao ?? []} />
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
