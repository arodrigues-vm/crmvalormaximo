import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoAreaTexto, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { comoRegistoCp } from '../../componentes/personalizados'
import { agendaApi, NOMES_CAMPOS_COMPROMISSO } from './api'
import { ECRA_COMPROMISSO } from './disposicao'

const ETIQUETA: Record<string, 'sucesso' | 'aviso' | 'neutra'> = {
  agendado: 'aviso',
  concluido: 'sucesso',
  cancelado: 'neutra',
}

type Acao = 'cancelar' | 'reabrir' | 'eliminar'

export function CompromissoConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [dialogo, setDialogo] = useState<Acao | null>(null)
  const [motivo, setMotivo] = useState('')
  const {
    data: x,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['agenda', 'compromisso', id],
    queryFn: () => agendaApi.obter(id),
  })
  const opcoes = useQuery({ queryKey: ['agenda', 'opcoes'], queryFn: agendaApi.opcoes, staleTime: 60_000 })
  const estadoDe = (cat: string) => opcoes.data?.estados.find((e) => e.categoria === cat)
  const mudar = useMutation({
    mutationFn: ({ cat, motivo }: { cat: string; motivo?: string }) =>
      agendaApi.mudarEstado(Number(id), estadoDe(cat)!.id, motivo),
    onSuccess: (n) => {
      qc.setQueryData(['agenda', 'compromisso', id], n)
      qc.invalidateQueries({ queryKey: ['agenda', 'eventos'] })
      setDialogo(null)
      setMotivo('')
    },
  })
  const eliminar = useMutation({
    mutationFn: () => agendaApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] })
      navegar('/agenda', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Compromisso não encontrado ou sem acesso.</p>
  if (!x) return <p className="erro">Não foi possível carregar o compromisso.</p>
  const c = x
  const cat = c.estado_categoria ?? 'agendado'
  const erroMudar =
    mudar.error instanceof ErroApi
      ? Object.values(mudar.error.campos).flat().join(' ') || mudar.error.message
      : mudar.error
        ? 'Não foi possível gravar.'
        : null

  function desenharCampo(k: string): ReactNode {
    switch (k) {
      case 'titulo':
        return <Dado rotulo="Título">{c.titulo}</Dado>
      case 'tipo':
        return <Dado rotulo="Tipo">{c.tipo_nome}</Dado>
      case 'inicio':
        return <Dado rotulo="Início">{momentoPt(c.inicio)}</Dado>
      case 'fim':
        return <Dado rotulo="Fim">{c.fim && momentoPt(c.fim)}</Dado>
      case 'local':
        return <Dado rotulo="Local">{c.local}</Dado>
      case 'estado':
        return (
          <Dado rotulo="Estado">
            {c.estado_nome}
            {c.motivo_estado && <small className="ajuda"> · {c.motivo_estado}</small>}
          </Dado>
        )
      case 'responsavel':
        return <Dado rotulo="Responsável">{c.responsavel_nome}</Dado>
      case 'entidade':
        return (
          <Dado rotulo="Entidade">{c.entidade && <Link to={`/entidades/${c.entidade}`}>{c.entidade_nome}</Link>}</Dado>
        )
      case 'imovel':
        return <Dado rotulo="Imóvel">{c.imovel && <Link to={`/imoveis/${c.imovel}`}>{c.imovel_descricao}</Link>}</Dado>
      case 'descricao':
        return (
          <Dado rotulo="Descrição" largo>
            {c.descricao && <span className="texto-livre">{c.descricao}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Agenda"
        caminho="/agenda"
        referencia={c.referencia}
        titulo={c.titulo}
        etiqueta={c.estado_nome ? { texto: c.estado_nome, tipo: ETIQUETA[cat] ?? 'neutra' } : undefined}
        acoes={
          <>
            {c.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setDialogo('eliminar')}>
                Eliminar
              </button>
            )}
            {c.acoes.editar && cat === 'agendado' && (
              <>
                <button className="botao-secundario" onClick={() => setDialogo('cancelar')}>
                  Cancelar compromisso
                </button>
                <button
                  className="botao-secundario"
                  disabled={mudar.isPending}
                  onClick={() => mudar.mutate({ cat: 'concluido' })}
                >
                  Marcar como concluído
                </button>
              </>
            )}
            {c.acoes.editar && cat !== 'agendado' && (
              <button className="botao-secundario" onClick={() => setDialogo('reabrir')}>
                Reabrir
              </button>
            )}
            {c.acoes.editar && (
              <Link to={`/agenda/compromissos/${c.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />
      {erroMudar && !dialogo && (
        <p className="erro" role="alert">
          {erroMudar}
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_COMPROMISSO}
        modo="ver"
        registo={comoRegistoCp(c)}
        campo={desenharCampo}
        abertoInicial={(b) => b.chave !== 'descricao' || !!c.descricao}
      />

      <Bloco titulo="Contactos e notas" abertoInicial={false}>
        <Interacoes
          base={`/api/agenda/compromissos/${c.id}/interacoes/`}
          podeEditar={c.acoes.editar}
          tipos={opcoes.data?.tipos_interacao ?? []}
        />
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['agenda', c.id, 'historico']}
              obter={() => agendaApi.historico(c.id)}
              nomesCampos={NOMES_CAMPOS_COMPROMISSO}
            />
            <p className="ajuda">Criado em {momentoPt(c.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo={dialogo === 'reabrir' ? 'Reabrir compromisso' : 'Cancelar compromisso'}
        aberto={dialogo === 'cancelar' || dialogo === 'reabrir'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button
              className="botao-principal"
              disabled={mudar.isPending}
              onClick={() => mudar.mutate({ cat: dialogo === 'reabrir' ? 'agendado' : 'cancelado', motivo })}
            >
              {dialogo === 'reabrir' ? 'Reabrir' : 'Cancelar compromisso'}
            </button>
          </>
        }
      >
        <CampoAreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {erroMudar && (
          <p className="erro" role="alert">
            {erroMudar}
          </p>
        )}
      </Dialogo>

      <Dialogo
        titulo="Eliminar compromisso"
        aberto={dialogo === 'eliminar'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>Se o compromisso não se realizou, prefira «Cancelar compromisso» (fica registado o motivo).</p>
      </Dialogo>
    </div>
  )
}
