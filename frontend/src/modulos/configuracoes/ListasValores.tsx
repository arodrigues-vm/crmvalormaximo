import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ErroApi, pedido } from '../../api/cliente'

interface Valor {
  id: number
  nome: string
  ordem: number
  ativo: boolean
  categoria: string
}
interface Lista {
  chave: string
  nome: string
  modulo: string
  descricao: string
  categorias: { valor: string; nome: string }[]
  valores: Valor[]
}

const MODULOS: Record<string, string> = {
  entidades: 'Entidades',
  imoveis: 'Imóveis',
  angariacoes: 'Angariações',
  oportunidades: 'Oportunidades',
  procuras: 'Procuras',
  geral: 'Geral',
}

const listasApi = {
  todas: () => pedido<Lista[]>('/api/listas/'),
  adicionar: (chave: string, nome: string, categoria: string) =>
    pedido<Lista>(`/api/listas/${chave}/valores/`, { json: { nome, categoria } }),
  alterar: (id: number, dados: Partial<Pick<Valor, 'nome' | 'ativo'>>) =>
    pedido<Lista>(`/api/listas/valores/${id}/`, { method: 'PATCH', json: dados }),
  ordenar: (chave: string, ids: number[]) => pedido<Lista>(`/api/listas/${chave}/ordenar/`, { json: { ids } }),
}

/** Configurações → Listas de valores: edição das listas suspensas sem programação. */
export function ListasValores() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { data: listas = [], isLoading } = useQuery({ queryKey: ['listas'], queryFn: listasApi.todas })
  const chave = params.get('lista') ?? listas[0]?.chave
  const lista = listas.find((l) => l.chave === chave)
  const [novo, setNovo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [aEditar, setAEditar] = useState<{ id: number; nome: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const aplicar = (atualizada: Lista) => {
    qc.setQueryData<Lista[]>(['listas'], (ls) => ls?.map((l) => (l.chave === atualizada.chave ? atualizada : l)))
    // Os formulários voltam a pedir as opções atualizadas.
    qc.invalidateQueries({ predicate: (q) => q.queryKey.includes('opcoes') })
    setErro(null)
  }
  const falha = (e: unknown) =>
    setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Não foi possível gravar.')

  const adicionar = useMutation({
    mutationFn: () => listasApi.adicionar(lista!.chave, novo, categoria),
    onSuccess: (l) => {
      aplicar(l)
      setNovo('')
      setCategoria('')
    },
    onError: falha,
  })
  const alterar = useMutation({
    mutationFn: (a: { id: number; dados: Partial<Valor> }) => listasApi.alterar(a.id, a.dados),
    onSuccess: (l) => {
      aplicar(l)
      setAEditar(null)
    },
    onError: falha,
  })
  const ordenar = useMutation({
    mutationFn: (ids: number[]) => listasApi.ordenar(lista!.chave, ids),
    onSuccess: aplicar,
    onError: falha,
  })

  function mover(i: number, d: -1 | 1) {
    if (!lista) return
    const ids = lista.valores.map((v) => v.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    ordenar.mutate(ids)
  }

  function submeterNovo(e: FormEvent) {
    e.preventDefault()
    if (!novo.trim()) return
    if (lista!.categorias.length > 0 && !categoria) {
      setErro('Escolha a categoria do novo valor.')
      return
    }
    adicionar.mutate()
  }

  if (isLoading) return <p className="a-carregar">A carregar…</p>

  const grupos = Object.entries(
    listas.reduce<Record<string, Lista[]>>((acc, l) => ({ ...acc, [l.modulo]: [...(acc[l.modulo] ?? []), l] }), {}),
  )

  return (
    <div className="configuracao">
      <nav className="configuracao-menu" aria-label="Listas de valores">
        {grupos.map(([modulo, ls]) => (
          <div key={modulo}>
            <p className="grupo-nome-claro">{MODULOS[modulo] ?? modulo}</p>
            <ul>
              {ls.map((l) => (
                <li key={l.chave}>
                  <button
                    type="button"
                    className={l.chave === chave ? 'ativa' : ''}
                    onClick={() => {
                      setParams({ lista: l.chave }, { replace: true })
                      setErro(null)
                      setAEditar(null)
                    }}
                  >
                    {l.nome}
                    <small>{l.valores.filter((v) => v.ativo).length}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {lista && (
        <section className="bloco configuracao-lista">
          <div className="bloco-conteudo">
            <h2 className="ficha-titulo">{lista.nome}</h2>
            {lista.descricao && <p className="ajuda">{lista.descricao}</p>}
            {lista.categorias.length > 0 && (
              <p className="aviso-duplicados">
                Cada valor desta lista pertence a uma <strong>categoria fixa</strong> (
                {lista.categorias.map((c) => c.nome).join(', ')}), da qual dependem regras da aplicação. Pode criar e
                renomear valores livremente; a categoria escolhe-se ao criar e não muda depois.
              </p>
            )}
            <p className="ajuda">
              Os valores não se apagam: desative-os. Os registos que já os usam mantêm-nos, mas deixam de poder ser
              escolhidos.
            </p>
            {erro && (
              <p className="erro" role="alert">
                {erro}
              </p>
            )}
            {lista.valores.length === 0 && <p className="ajuda">Esta lista ainda não tem valores.</p>}
            <ol className="valores-lista">
              {lista.valores.map((v, i) => (
                <li key={v.id} className={v.ativo ? '' : 'inativo'}>
                  <span className="valor-ordem">
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Subir ${v.nome}`}
                      disabled={i === 0 || ordenar.isPending}
                      onClick={() => mover(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Descer ${v.nome}`}
                      disabled={i === lista.valores.length - 1 || ordenar.isPending}
                      onClick={() => mover(i, 1)}
                    >
                      ↓
                    </button>
                  </span>
                  {aEditar?.id === v.id ? (
                    <form
                      className="valor-edicao"
                      onSubmit={(e) => {
                        e.preventDefault()
                        alterar.mutate({ id: v.id, dados: { nome: aEditar.nome } })
                      }}
                    >
                      <input
                        aria-label="Novo nome"
                        value={aEditar.nome}
                        onChange={(e) => setAEditar({ id: v.id, nome: e.target.value })}
                        autoFocus
                      />
                      <button type="submit" className="botao-principal">
                        Guardar
                      </button>
                      <button type="button" className="botao-secundario" onClick={() => setAEditar(null)}>
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="valor-nome">
                        {v.nome}
                        {v.categoria && (
                          <span className="etiqueta etiqueta-categoria">
                            {lista.categorias.find((c) => c.valor === v.categoria)?.nome ?? v.categoria}
                          </span>
                        )}
                        {!v.categoria && lista.categorias.length > 0 && (
                          <select
                            aria-label={`Categoria de ${v.nome}`}
                            className="selecao-categoria"
                            value=""
                            onChange={(e) =>
                              e.target.value &&
                              window.confirm('A categoria não pode ser mudada depois. Confirmar?') &&
                              alterar.mutate({ id: v.id, dados: { categoria: e.target.value } })
                            }
                          >
                            <option value="">Sem categoria — escolher…</option>
                            {lista.categorias.map((c) => (
                              <option key={c.valor} value={c.valor}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        )}
                        {!v.ativo && <span className="etiqueta etiqueta-neutra">Desativado</span>}
                      </span>
                      <button
                        type="button"
                        className="botao-secundario"
                        onClick={() => setAEditar({ id: v.id, nome: v.nome })}
                      >
                        Renomear
                      </button>
                      <button
                        type="button"
                        className="botao-secundario"
                        onClick={() => alterar.mutate({ id: v.id, dados: { ativo: !v.ativo } })}
                      >
                        {v.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ol>
            <form className="valor-novo" onSubmit={submeterNovo}>
              <input
                aria-label="Novo valor"
                placeholder="Novo valor"
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
              />
              {lista.categorias.length > 0 && (
                <select aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="">Categoria…</option>
                  {lista.categorias.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className="botao-principal" disabled={!novo.trim() || adicionar.isPending}>
                + Adicionar
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  )
}
