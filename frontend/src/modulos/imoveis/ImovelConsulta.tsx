import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { Dado } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { CabecalhoRegisto, HistoricoRegisto } from '../../componentes/Ficha'
import { formatarArea, formatarEuros, formatarPercentagem, momentoPt } from '../../componentes/formatar'
import { LigacoesExternas } from '../../componentes/LigacoesExternas'
import { pedido } from '../../api/cliente'
import { etiquetaStatus, imoveisApi, NOMES_CAMPOS_IMOVEL, tituloImovel } from './api'
import { FotografiaImovel } from './FotografiaImovel'

export function ImovelConsulta() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const [confirmar, setConfirmar] = useState(false)
  const { data: i, error, isLoading } = useQuery({ queryKey: ['imoveis', id], queryFn: () => imoveisApi.obter(id) })
  const tiposLigacao = useQuery({
    queryKey: ['listas', 'tipos_ligacao', 'opcoes'],
    queryFn: async () =>
      (await pedido<{ chave: string; valores: { id: number; nome: string; ativo: boolean }[] }[]>('/api/listas/'))
        .find((l) => l.chave === 'tipos_ligacao')
        ?.valores.filter((v) => v.ativo) ?? [],
    staleTime: 60_000,
  })
  const eliminar = useMutation({
    mutationFn: () => imoveisApi.eliminar(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      navegar('/imoveis', { replace: true })
    },
  })

  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Imóvel não encontrado ou sem acesso.</p>
  if (!i) return <p className="erro">Não foi possível carregar o imóvel.</p>

  const n = i.nomes
  const morada = [
    [i.rua, i.numero_policia].filter(Boolean).join(', '),
    i.complemento,
    [i.codigo_postal, i.localidade].filter(Boolean).join(' '),
  ].filter(Boolean)
  const somaQuotas = i.proprietarios_detalhe.reduce((s, p) => s + (p.quota ? Number(p.quota) : 0), 0)
  const todasQuotas = i.proprietarios_detalhe.length > 0 && i.proprietarios_detalhe.every((p) => p.quota !== null)

  return (
    <div className="ficha">
      <CabecalhoRegisto
        modulo="Imóveis"
        caminho="/imoveis"
        referencia={i.referencia}
        titulo={tituloImovel({ tipo: n.tipo, tipologia: n.tipologia, localidade: i.localidade })}
        etiqueta={n.status ? { texto: n.status, tipo: etiquetaStatus(n.status_categoria) } : undefined}
        acoes={
          <>
            {i.acoes.eliminar && (
              <button className="botao-secundario" onClick={() => setConfirmar(true)}>
                Eliminar
              </button>
            )}
            {i.acoes.editar && (
              <Link to={`/imoveis/${i.id}/editar`} className="botao-principal">
                Editar
              </Link>
            )}
          </>
        }
      />

      <div className="ficha-topo">
        <FotografiaImovel imovel={i} />
        <Bloco titulo="Comercialização">
          <dl className="grelha-dados">
            <Dado rotulo="Operação">{n.operacao}</Dado>
            <Dado rotulo="Preço">{formatarEuros(i.preco)}</Dado>
            <Dado rotulo="Estado de comercialização">{n.estado_comercializacao}</Dado>
            <Dado rotulo="Status">{n.status}</Dado>
            <Dado rotulo="Responsável">{i.responsavel_nome}</Dado>
          </dl>
        </Bloco>
      </div>

      <Bloco titulo="Proprietários">
        {i.proprietarios_detalhe.length === 0 ? (
          <p className="ajuda">Sem proprietários registados.</p>
        ) : (
          <>
            <ul className="lista-relacoes">
              {i.proprietarios_detalhe.map((p) => (
                <li key={p.entidade}>
                  {p.acessivel ? (
                    <Link to={`/entidades/${p.entidade}`}>
                      {p.nome_completo} <small className="ajuda">{p.referencia}</small>
                    </Link>
                  ) : (
                    <span className="vazio">Entidade a que não tem acesso</span>
                  )}
                  <span className="relacao-tipo">{formatarPercentagem(p.quota) ?? 'Quota não indicada'}</span>
                </li>
              ))}
            </ul>
            {todasQuotas && Math.abs(somaQuotas - 100) > 0.0001 && (
              <p className="aviso-duplicados">A soma das quotas é {formatarPercentagem(String(somaQuotas))}.</p>
            )}
          </>
        )}
      </Bloco>

      <Bloco titulo="Classificação e características">
        <dl className="grelha-dados">
          <Dado rotulo="Tipo">{n.tipo}</Dado>
          <Dado rotulo="Tipologia">{n.tipologia}</Dado>
          <Dado rotulo="Condição física">{n.condicao_fisica}</Dado>
          <Dado rotulo="Quartos">{i.quartos}</Dado>
          <Dado rotulo="Casas de banho">{i.casas_banho}</Dado>
          <Dado rotulo="Ano de construção">{i.ano_construcao}</Dado>
          <Dado rotulo="Piso">{i.piso}</Dado>
          <Dado rotulo="Elevador">{i.elevador === null ? null : i.elevador ? 'Sim' : 'Não'}</Dado>
          <Dado rotulo="Lugares de estacionamento">{i.lugares_estacionamento}</Dado>
          <Dado rotulo="Certificado energético">{n.certificado_energetico}</Dado>
          <Dado rotulo="Zonas exteriores" largo>
            {n.zonas_exteriores.join(', ')}
          </Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Áreas">
        <dl className="grelha-dados">
          <Dado rotulo="Área bruta privativa">{formatarArea(i.area_bruta_privativa)}</Dado>
          <Dado rotulo="Área bruta dependente">{formatarArea(i.area_bruta_dependente)}</Dado>
          <Dado rotulo="Área útil">{formatarArea(i.area_util)}</Dado>
          <Dado rotulo="Área do terreno">{formatarArea(i.area_terreno)}</Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Localização">
        <dl className="grelha-dados">
          <Dado rotulo="Morada" largo>
            {morada.length > 0 && morada.map((l) => <div key={l}>{l}</div>)}
          </Dado>
          <Dado rotulo="Localização administrativa">
            {i.localizacao && `${i.localizacao.freguesia}, ${i.localizacao.concelho}, ${i.localizacao.distrito}`}
          </Dado>
          <Dado rotulo="Zona comercial">{n.zona_comercial}</Dado>
          <Dado rotulo="Localização descritiva">{i.localizacao_descritiva}</Dado>
        </dl>
      </Bloco>

      <Bloco titulo="Fotografias, documentos e outras ligações">
        <LigacoesExternas
          base={`/api/imoveis/${i.id}/ligacoes/`}
          podeEditar={i.acoes.editar}
          tipos={tiposLigacao.data ?? []}
        />
      </Bloco>

      <Bloco titulo="Descrição" abertoInicial={!!i.descricao}>
        <p className="texto-livre">{i.descricao || <span className="vazio">—</span>}</p>
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!i.observacoes}>
        <p className="texto-livre">{i.observacoes || <span className="vazio">—</span>}</p>
      </Bloco>

      <Bloco titulo="Histórico" abertoInicial={false}>
        {() => (
          <>
            <HistoricoRegisto
              chave={['imoveis', i.id, 'historico']}
              obter={() => imoveisApi.historico(i.id)}
              nomesCampos={NOMES_CAMPOS_IMOVEL}
            />
            <p className="ajuda">
              Criado em {momentoPt(i.criado_em)} · última alteração em {momentoPt(i.atualizado_em)}
            </p>
          </>
        )}
      </Bloco>

      <Dialogo
        titulo="Eliminar imóvel"
        aberto={confirmar}
        aoFechar={() => setConfirmar(false)}
        acoes={
          <>
            <button className="botao-secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button className="botao-perigo" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
              Enviar para a lixeira
            </button>
          </>
        }
      >
        <p>
          O imóvel <strong>{i.referencia}</strong> será enviado para a lixeira. Pode ser restaurado por um utilizador
          autorizado. Se apenas deixou de estar em comercialização, prefira mudar o <strong>Status</strong>.
        </p>
      </Dialogo>
    </div>
  )
}
