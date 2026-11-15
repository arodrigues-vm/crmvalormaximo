import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../app/sessao'
import { Bloco } from '../../componentes/Bloco'
import { CampoCaixa, Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { dataPt, formatarEuros, momentoPt } from '../../componentes/formatar'
import { Interacoes } from '../../componentes/Interacoes'
import { ETIQUETA_CATEGORIA, NOMES_CAMPOS_OPORTUNIDADE, oportunidadesApi } from './api'

export function OportunidadeConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const { pode } = useSessao()
  const [dialogo, setDialogo] = useState<null | 'converter' | 'eliminar'>(null)
  const [criarCmi, setCriarCmi] = useState(true)
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
    mutationFn: () => oportunidadesApi.converter(Number(id), criarCmi),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['oportunidades'] })
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      qc.invalidateQueries({ queryKey: ['angariacoes'] })
      setDialogo(null)
      // Abre o CMI criado (para completar e assinar) ou o imóvel.
      navegar(r.angariacao ? `/angariacoes/${r.angariacao}/editar` : `/imoveis/${r.imovel}`)
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
  const podeConverter = o.acoes.editar && !o.angariacao_gerada && (o.imovel !== null || pode('imoveis', 'criar'))

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
          <Dado rotulo="Qualificação">{n.qualificacao}</Dado>
          <Dado rotulo="Origem">{n.origem}</Dado>
          <Dado rotulo="Preço pretendido">{formatarEuros(o.preco_pretendido)}</Dado>
          <Dado rotulo="Prazo pretendido">{dataPt(o.prazo)}</Dado>
          <Dado rotulo="Responsável">{o.responsavel_nome}</Dado>
          <Dado rotulo="Motivação" largo>
            {o.motivacao && <span className="texto-livre">{o.motivacao}</span>}
          </Dado>
        </dl>
        {podeConverter && (
          <div className="acoes-bloco">
            <button className="botao-principal" onClick={() => setDialogo('converter')}>
              {o.imovel ? 'Criar CMI' : 'Converter em imóvel / CMI'}
            </button>
          </div>
        )}
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
        titulo={o.imovel ? 'Criar CMI' : 'Converter em imóvel / CMI'}
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
          {o.imovel ? (
            <p>Vai ser criada uma angariação (CMI) por assinar para o imóvel {o.imovel_descricao}.</p>
          ) : (
            <p>
              Vai ser criado o <strong>imóvel</strong> «{o.imovel_descricao}», com {o.entidade_nome ?? 'o proprietário'}{' '}
              como proprietário e o preço pretendido.
            </p>
          )}
          {!o.imovel && (
            <CampoCaixa
              rotulo="Criar também a angariação (CMI) por assinar"
              checked={criarCmi}
              onChange={(e) => setCriarCmi(e.target.checked)}
            />
          )}
          <p className="ajuda">
            A oportunidade mantém-se, ligada ao que for criado. O estado não muda sozinho: atualize-o quando o CMI for
            assinado.
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
