import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { formatarEuros, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { VerQualificacao } from '../../componentes/Qualificacao'
import {
  ETIQUETA_CATEGORIA,
  NOMES_CAMPOS_OPORTUNIDADE,
  oportunidadesApi,
  QUALIFICACAO_NEGOCIO,
  QUALIFICACAO_PROPRIETARIO,
} from './api'

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

      <Bloco titulo="Oportunidade">
        <dl className="grelha-dados">
          <Dado rotulo="Proprietário">
            {o.entidade_nome ? (
              <Link to={`/entidades/${o.entidade}`}>{o.entidade_nome}</Link>
            ) : (
              'Entidade a que não tem acesso'
            )}
          </Dado>
          <Dado rotulo="Operação pretendida">{n.operacao}</Dado>
          <Dado rotulo="Estado">{n.estado}</Dado>
          <Dado rotulo="Origem">{n.origem}</Dado>
          <Dado rotulo="Valor pretendido">{formatarEuros(o.preco_pretendido)}</Dado>
          <Dado rotulo="Responsável">{o.responsavel_nome}</Dado>
        </dl>
        {podeCriarImovel && (
          <div className="acoes-bloco">
            <button className="botao-principal" onClick={() => setDialogo('converter')}>
              Criar imóvel
            </button>
          </div>
        )}
        {o.imovel !== null && (
          <div className="acoes-bloco">
            <Link to={`/imoveis/${o.imovel}`} className="botao-principal">
              Abrir imóvel (atualizar e criar o CMI)
            </Link>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Qualificação do proprietário">
        <VerQualificacao campos={QUALIFICACAO_PROPRIETARIO} registo={registo} />
      </Bloco>

      <Bloco titulo="Imóvel">
        {o.imovel ? (
          <p>
            <Link to={`/imoveis/${o.imovel}`}>{o.imovel_descricao}</Link>
          </p>
        ) : (
          <dl className="grelha-dados">
            <Dado rotulo="Tipo">{n.tipo_imovel}</Dado>
            <Dado rotulo="Tipologia">{n.tipologia}</Dado>
            <Dado rotulo="Localidade">{o.localidade}</Dado>
            <Dado rotulo="Descrição" largo>
              {o.descricao_imovel}
            </Dado>
          </dl>
        )}
        {o.url_anuncio && (
          <p>
            Anúncio:{' '}
            <a href={o.url_anuncio} target="_blank" rel="noopener noreferrer">
              {o.url_anuncio}
            </a>
          </p>
        )}
      </Bloco>

      <Bloco titulo="Negócio">
        <VerQualificacao campos={QUALIFICACAO_NEGOCIO} registo={registo} />
      </Bloco>

      <Bloco titulo="Contactos registados">
        <Interacoes
          base={`/api/oportunidades/${o.id}/interacoes/`}
          podeEditar={o.acoes.editar}
          tipos={opcoes.data?.tipos_interacao ?? []}
        />
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!o.observacoes}>
        <p className="texto-livre">{o.observacoes || <span className="vazio">—</span>}</p>
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
