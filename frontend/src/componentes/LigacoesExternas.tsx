import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ErroApi, pedido } from '../api/cliente'
import { CampoSelecao, CampoTexto } from './campos'

interface Ligacao {
  id: number
  tipo: number
  tipo_nome: string
  titulo: string
  url: string
}

interface Props {
  /** Ex.: /api/imoveis/5/ligacoes/ */
  base: string
  podeEditar: boolean
  tipos: { id: number; nome: string }[]
}

/**
 * Ligações para pastas ou ficheiros externos (OneDrive, Google Drive…): fotografias adicionais,
 * documentos, etc. O CRM guarda apenas o endereço; o acesso ao conteúdo depende das
 * permissões definidas no próprio serviço externo.
 */
export function LigacoesExternas({ base, podeEditar, tipos }: Props) {
  const qc = useQueryClient()
  const chave = ['ligacoes', base]
  const { data: ligacoes = [], isLoading } = useQuery({ queryKey: chave, queryFn: () => pedido<Ligacao[]>(base) })
  const [aAdicionar, setAAdicionar] = useState(false)
  const [tipo, setTipo] = useState('')
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [erros, setErros] = useState<Record<string, string[]>>({})

  const criar = useMutation({
    mutationFn: () => pedido<Ligacao[]>(base, { json: { tipo: Number(tipo), titulo, url: url.trim() } }),
    onSuccess: (l) => {
      qc.setQueryData(chave, l)
      setAAdicionar(false)
      setTipo('')
      setTitulo('')
      setUrl('')
      setErros({})
    },
    onError: (e) => setErros(e instanceof ErroApi ? e.campos : { url: ['Não foi possível gravar.'] }),
  })
  const remover = useMutation({
    mutationFn: (id: number) => pedido<null>(`${base}${id}/`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
  })

  function submeter(e: FormEvent) {
    e.preventDefault()
    const faltam: Record<string, string[]> = {}
    if (!tipo) faltam.tipo = ['Escolha o tipo.']
    if (!titulo.trim()) faltam.titulo = ['Indique um título.']
    if (!url.trim()) faltam.url = ['Cole o endereço da pasta ou ficheiro.']
    if (Object.keys(faltam).length) {
      setErros(faltam)
      return
    }
    criar.mutate()
  }

  if (isLoading) return <p className="ajuda">A carregar…</p>
  return (
    <div>
      {ligacoes.length === 0 && !aAdicionar && <p className="ajuda">Sem ligações.</p>}
      {ligacoes.length > 0 && (
        <ul className="lista-relacoes">
          {ligacoes.map((l) => (
            <li key={l.id}>
              <span className="relacao-tipo">{l.tipo_nome}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.titulo} ↗
              </a>
              {podeEditar && (
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Remover ligação ${l.titulo}`}
                  onClick={() => {
                    if (window.confirm('Remover esta ligação? (A pasta externa não é apagada.)')) remover.mutate(l.id)
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
          + Adicionar ligação
        </button>
      )}
      {aAdicionar && (
        <form className="nova-relacao" onSubmit={submeter}>
          <CampoSelecao
            rotulo="Tipo"
            vazio="—"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            opcoes={tipos.map((t) => ({ valor: t.id, nome: t.nome }))}
            erro={erros.tipo}
          />
          <CampoTexto
            rotulo="Título"
            value={titulo}
            placeholder="Ex.: Fotografias do imóvel"
            onChange={(e) => setTitulo(e.target.value)}
            erro={erros.titulo}
          />
          <CampoTexto
            rotulo="Endereço (link)"
            type="url"
            largo
            placeholder="https://onedrive.live.com/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            erro={erros.url}
            ajuda="Copie o link de partilha da pasta no OneDrive (ou outro serviço) e cole-o aqui."
          />
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
