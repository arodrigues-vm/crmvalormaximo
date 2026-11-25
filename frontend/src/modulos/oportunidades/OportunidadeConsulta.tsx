import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { formatarEuros, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { VerCampoQ } from '../../componentes/Qualificacao'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import {
  ETIQUETA_CATEGORIA,
  NOMES_CAMPOS_OPORTUNIDADE,
  oportunidadesApi,
  QUALIFICACAO_NEGOCIO,
  QUALIFICACAO_PROPRIETARIO,
} from './api'
import { ECRA_OPORTUNIDADE } from './disposicao'

export function OportunidadeConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const { pode } = useSessao()
  const [dialogo, setDialogo] = useState<null | 'converter' | 'eliminar'>(null)
  const [erro, setErro] = useState<string | null>(null)
  const {
    data: o,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['oportunidades', id],
    queryFn: () => oportunidadesApi.obter(id),
  })
  const opcoes = useQuery({
    queryKey: ['oportunidades', 'opcoes'],
    queryFn: oportunidadesApi.opcoes,
    staleTime: 60_000,
  })

  const converter = useMutation({
    mutationFn: () => oportunidadesApi.converter(Number(id), false),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['oportunidades'] })
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      qc.invalidateQueries({ queryKey: ['angariacoes'] })
      setDialogo(null)
      // D-35: o passo seguinte é completar o imóvel; o CMI cria-se depois, na ficha do imóvel.
      navegar(`/imoveis/${r.imovel}/editar`)
    },
    onError: (e) => setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falhou.'),
  })
  const eliminar = useMutation({
    mutationFn: () => oportunidadesApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oportunidades'] })
      navegar('/oportunidades', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Oportunidade não encontrada ou sem acesso.</p>
  if (!o) return <p className="erro">Não foi possível carregar a oportunidade.</p>
  const n = o.nomes
  const registo = o as unknown as Record<string, unknown>
  const podeCriarImovel = o.acoes.editar && o.imovel === null && pode('imoveis', 'criar')

  const CAMPOS_Q = [...QUALIFICACAO_PROPRIETARIO, ...QUALIFICACAO_NEGOCIO]
  const op = o
  function desenharCampo(c: string): ReactNode {
    const q = CAMPOS_Q.find((x) => x.campo === c)
    if (q) return <VerCampoQ c={q} registo={registo} />
    if (op.imovel && ['tipo_imovel', 'tipologia', 'localidade', 'descricao_imovel'].includes(c)) return null
    switch (c) {
      case 'entidade':
        return (
          <Dado rotulo="Proprietário">
            {op.entidade_nome ? (
              <Link to={`/entidades/${op.entidade}`}>{op.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
        )
      case 'operacao':
        return <Dado rotulo="Operação pretendida">{n.operacao}</Dado>
      case 'estado':
        return <Dado rotulo="Estado">{n.estado}</Dado>
      case 'origem':
        return <Dado rotulo="Origem">{n.origem}</Dado>
      case 'preco_pretendido':
        return <Dado rotulo="Valor pretendido">{formatarEuros(op.preco_pretendido)}</Dado>
      case 'responsavel':
        return <Dado rotulo="Responsável">{op.responsavel_nome}</Dado>
      case 'imovel':
        return (
          <Dado rotulo="Imóvel registado">
            {op.imovel && <Link to={`/imoveis/${op.imovel}`}>{op.imovel_descricao}</Link>}
          </Dado>
        )
      case 'tipo_imovel':
        return <Dado rotulo="Tipo">{n.tipo_imovel}</Dado>
      case 'tipologia':
        return <Dado rotulo="Tipologia">{n.tipologia}</Dado>
      case 'localidade':
        return <Dado rotulo="Localidade">{op.localidade}</Dado>
      case 'descricao_imovel':
        return (
          <Dado rotulo="Descrição" largo>
            {op.descricao_imovel}
          </Dado>
        )
      case 'url_anuncio':
        return (
          <Dado rotulo="Anúncio" largo>
            {op.url_anuncio && (
              <a href={op.url_anuncio} target="_blank" rel="noopener noreferrer">
                {op.url_anuncio}
              </a>
            )}
          </Dado>
        )
      case 'observacoes':
        return (
          <Dado rotulo="Observações" largo>
            {op.observacoes && <span className="texto-livre">{op.observacoes}</span>}
          </Dado>
        )
    }
    return null
  }

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Oportunidades"
        caminho="/oportunidades"
        referencia={o.referencia}
        titulo={`${o.entidade_nome ?? 'Proprietário'} · ${o.imovel_descricao}`}
        etiqueta={
          n.estado ? { texto: n.estado, tipo: ETIQUETA_CATEGORIA[o.estado_categoria ?? ''] ?? 'neutra' } : undefined
        }
        acoes={
          <>
            {o.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setDialogo('eliminar')}>
                Eliminar
              </button>
            )}
            {podeCriarImovel && (
              <button className="botao-secundario" onClick={() => setDialogo('converter')}>
                Criar imóvel
              </button>
            )}
            {o.imovel !== null && (
              <Link to={`/imoveis/${o.imovel}`} className="botao-secundario">
                Abrir imóvel (atualizar e criar o CMI)
              </Link>
            )}
            {o.acoes.editar && (
              <Link to={`/oportunidades/${o.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      {o.angariacao_gerada && (
        <p className="aviso-duplicados">
          Esta oportunidade deu origem ao CMI{' '}
          <Link to={`/angariacoes/${o.angariacao_gerada}`}>{o.angariacao_gerada_referencia}</Link>.
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_OPORTUNIDADE}
        modo="ver"
        campo={desenharCampo}
        abertoInicial={(b) => (b.chave === 'observacoes' ? !!o.observacoes : true)}
      />

      <Bloco titulo="Contactos registados">
        <Interacoes
          base={`/api/oportunidades/${o.id}/interacoes/`}
          podeEditar={o.acoes.editar}
          tipos={opcoes.data?.tipos_interacao ?? []}
        />
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['oportunidades', o.id, 'historico']}
              obter={() => oportunidadesApi.historico(o.id)}
              nomesCampos={NOMES_CAMPOS_OPORTUNIDADE}
            />
            <p className="ajuda">Criada em {momentoPt(o.criado_em)}</p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Criar imóvel"
        aberto={dialogo === 'converter'}
        aoFechar={() => setDialogo(null)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setDialogo(null)}>
              Cancelar
            </button>
            <button className="botao-principal" disabled={converter.isPending} onClick={() => converter.mutate()}>
              Confirmar
            </button>
          </>
        }
      >
        <div className="formulario-dialogo">
          <p>
            Vai ser criado o <strong>imóvel</strong> «{o.imovel_descricao}», com {o.entidade_nome ?? 'o proprietário'}{' '}
            como proprietário e o valor pretendido. A seguir abre-se o imóvel para o completar.
          </p>
          <p className="ajuda">
            Depois, na ficha do imóvel, crie a angariação (CMI) em <strong>Angariações (CMI)</strong>. A oportunidade
            mantém-se, ligada ao imóvel. O estado não muda sozinho: atualize-o quando o CMI for assinado.
          </p>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
        </div>
      </Dialogo>

      <Dialogo
        titulo="Eliminar oportunidade"
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
        <p>Se a oportunidade não avançou, prefira mudar o estado para «Perdida».</p>
      </Dialogo>
    </div>
  )
}
