import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { ErroApi, pedido } from '../../api/cliente'
import { CampoTexto } from '../../componentes/campos'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { entidadesApi, type Opcoes, type Relacao } from './api'

/** «15 de março» — o aniversário não precisa do ano. */
function aniversarioPt(data: string) {
  const [, mes, dia] = data.split('-').map(Number)
  return new Date(2000, mes - 1, dia).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
}

interface Props {
  entidadeId: number
  podeEditar: boolean
  tipos: Opcoes['tipos_relacao']
}

/** Relações com outras entidades (cônjuge, familiar, sócio, gerente…). Gravadas de imediato. */
export function RelacoesEntidade({ entidadeId, podeEditar, tipos }: Props) {
  const qc = useQueryClient()
  const chave = ['entidades', entidadeId, 'relacoes']
  const { data: relacoes = [], isLoading } = useQuery({
    queryKey: chave,
    queryFn: () => entidadesApi.relacoes(entidadeId),
  })
  const [aAdicionar, setAAdicionar] = useState(false)
  const [tipoSentido, setTipoSentido] = useState('')
  const [outra, setOutra] = useState<OpcaoPesquisa | null>(null)
  const [observacoes, setObservacoes] = useState('')
  // Data de aniversário da entidade relacionada: pré-preenchida com a que já consta da ficha dela.
  const [aniversario, setAniversario] = useState<string | null>(null)
  const ficha = useQuery({
    queryKey: ['entidades', String(outra?.id)],
    queryFn: () => entidadesApi.obter(outra!.id),
    enabled: !!outra,
  })
  const aniversarioMostrado = aniversario ?? ficha.data?.data_nascimento ?? ''
  const singular = !ficha.data || ficha.data.tipo_pessoa === 'singular'
  const [erro, setErro] = useState<string | null>(null)

  // Cada tipo assimétrico dá duas opções: «Gerente de» (esta entidade é a origem) e «Tem como gerente».
  const opcoes = tipos.flatMap((t) =>
    t.simetrica
      ? [{ valor: `${t.id}:direto`, nome: t.nome }]
      : [
          { valor: `${t.id}:direto`, nome: t.nome },
          { valor: `${t.id}:inverso`, nome: t.nome_inverso },
        ],
  )

  const criar = useMutation({
    mutationFn: () => {
      const [tipo, sentido] = tipoSentido.split(':')
      return entidadesApi.criarRelacao(entidadeId, {
        tipo: Number(tipo),
        sentido,
        entidade: outra!.id,
        observacoes,
        data_nascimento: singular && aniversarioMostrado ? aniversarioMostrado : null,
      })
    },
    onSuccess: (lista) => {
      qc.setQueryData(chave, lista)
      setAAdicionar(false)
      setTipoSentido('')
      setOutra(null)
      setObservacoes('')
      setAniversario(null)
      setErro(null)
    },
    onError: (e) => {
      if (e instanceof ErroApi) setErro(Object.values(e.campos).flat().join(' ') || e.message)
      else setErro('Não foi possível gravar a relação.')
    },
  })

  // Edição de uma relação existente (D-42): tipo/sentido e observações.
  const [aEditar, setAEditar] = useState<{ id: number; tipoSentido: string; observacoes: string } | null>(null)
  const editar = useMutation({
    mutationFn: (x: { id: number; tipoSentido: string; observacoes: string }) => {
      const [tipo, sentido] = x.tipoSentido.split(':')
      return pedido<Relacao[]>(`/api/entidades/${entidadeId}/relacoes/${x.id}/`, {
        method: 'PATCH',
        json: { tipo: Number(tipo), sentido, observacoes: x.observacoes },
      })
    },
    onSuccess: (lista) => {
      qc.setQueryData(chave, lista)
      setAEditar(null)
      setErro(null)
    },
    onError: (e) => setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falhou.'),
  })
  const sentidoAtual = (r: Relacao) => {
    const t = tipos.find((x) => x.id === r.tipo)
    return `${r.tipo}:${!t || t.simetrica || r.rotulo === t.nome ? 'direto' : 'inverso'}`
  }

  const remover = useMutation({
    mutationFn: (id: number) => entidadesApi.removerRelacao(entidadeId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
  })

  function submeter(e: FormEvent) {
    e.preventDefault()
    if (!tipoSentido || !outra) {
      setErro('Escolha o tipo de relação e a entidade.')
      return
    }
    criar.mutate()
  }

  if (isLoading) return <p className="ajuda">A carregar…</p>

  return (
    <div className="relacoes">
      {relacoes.length === 0 && !aAdicionar && <p className="ajuda">Sem entidades relacionadas.</p>}
      {relacoes.length > 0 && (
        <ul className="lista-relacoes">
          {relacoes.map((r) => (
            <li key={r.id}>
              <span className="relacao-tipo">{r.rotulo}</span>
              {r.entidade ? (
                <Link to={`/entidades/${r.entidade.id}`}>
                  {r.entidade.nome_completo} <small className="ajuda">{r.entidade.referencia}</small>
                </Link>
              ) : (
                <span className="vazio">Entidade a que não tem acesso</span>
              )}
              {r.entidade?.data_nascimento && (
                <small className="ajuda">Aniversário: {aniversarioPt(r.entidade.data_nascimento)}</small>
              )}
              {r.observacoes && <small className="ajuda">{r.observacoes}</small>}
              {podeEditar && r.acessivel && (
                <button
                  type="button"
                  className="ligacao-botao"
                  aria-label={`Editar relação ${r.rotulo}`}
                  onClick={() => setAEditar({ id: r.id, tipoSentido: sentidoAtual(r), observacoes: r.observacoes })}
                >
                  Editar
                </button>
              )}
              {aEditar?.id === r.id && (
                <form
                  className="nova-relacao largo"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    editar.mutate(aEditar)
                  }}
                >
                  <div className="campo">
                    <label htmlFor={`relacao-editar-${r.id}`}>Esta entidade é…</label>
                    <select
                      id={`relacao-editar-${r.id}`}
                      value={aEditar.tipoSentido}
                      onChange={(e) => setAEditar({ ...aEditar, tipoSentido: e.target.value })}
                    >
                      {opcoes.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <CampoTexto
                    rotulo="Observações"
                    value={aEditar.observacoes}
                    onChange={(e) => setAEditar({ ...aEditar, observacoes: e.target.value })}
                  />
                  <div className="acoes-formulario largo">
                    <button type="button" className="botao-secundario" onClick={() => setAEditar(null)}>
                      Cancelar
                    </button>
                    <button type="submit" className="botao-principal" disabled={editar.isPending}>
                      Guardar
                    </button>
                  </div>
                </form>
              )}
              {podeEditar && (
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Remover relação ${r.rotulo}`}
                  disabled={remover.isPending}
                  onClick={() => {
                    if (window.confirm('Remover esta relação?')) remover.mutate(r.id)
                  }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && !aAdicionar && (
        <button type="button" className="botao-secundario" onClick={() => setAAdicionar(true)}>
          + Adicionar entidade relacionada
        </button>
      )}

      {aAdicionar && (
        <form className="nova-relacao" onSubmit={submeter}>
          <div className="campo">
            <label htmlFor="relacao-tipo">Esta entidade é…</label>
            <select id="relacao-tipo" value={tipoSentido} onChange={(e) => setTipoSentido(e.target.value)}>
              <option value="">—</option>
              {opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <SeletorPesquisavel
            rotulo="Entidade relacionada"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={outra}
            aoMudar={(x) => {
              setOutra(x)
              setAniversario(null)
            }}
            excluir={[entidadeId]}
          />
          {singular && (
            <CampoTexto
              rotulo="Data de aniversário"
              type="date"
              value={aniversarioMostrado}
              onChange={(e) => setAniversario(e.target.value)}
              ajuda="Fica guardada como data de nascimento na ficha da entidade relacionada."
            />
          )}
          <CampoTexto rotulo="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          {erro && (
            <p className="erro largo" role="alert">
              {erro}
            </p>
          )}
          <div className="acoes-formulario largo">
            <button type="button" className="botao-secundario" onClick={() => setAAdicionar(false)}>
              Cancelar
            </button>
            <button type="submit" className="botao-principal" disabled={criar.isPending}>
              Adicionar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
