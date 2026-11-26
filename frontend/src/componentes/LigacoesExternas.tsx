import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ErroApi, pedido } from '../api/cliente'
import { CampoSelecao, CampoTexto } from './campos'

interface Ligacao {
  id: number
  tipo: number
  tipo_nome: string
  tipo_documento?: number | null
  tipo_documento_nome?: string | null
  titulo: string
  url: string
}

interface Props {
  /** Ex.: /api/imoveis/5/ligacoes/ */
  base: string
  podeEditar: boolean
  tipos: { id: number; nome: string }[]
  /** Tipos de documento do negócio (D-50): quando indicados, cada ligação pode dizer que documento é. */
  tiposDocumento?: { id: number; nome: string }[]
  /** Chamado depois de cada alteração (ex.: atualizar a lista de verificação dos documentos). */
  aoMudar?: () => void
}

/**
 * Ligações para pastas ou ficheiros externos (OneDrive, Google Drive…): fotografias adicionais,
 * documentos, etc. O CRM guarda apenas o endereço; o acesso ao conteúdo depende das
 * permissões definidas no próprio serviço externo.
 */
export function LigacoesExternas({ base, podeEditar, tipos, tiposDocumento, aoMudar }: Props) {
  const qc = useQueryClient()
  const chave = ['ligacoes', base]
  const { data: ligacoes = [], isLoading } = useQuery({ queryKey: chave, queryFn: () => pedido<Ligacao[]>(base) })
  const [aAdicionar, setAAdicionar] = useState(false)
  // Edição (D-42): reaproveita o mesmo formulário.
  const [aEditar, setAEditar] = useState<number | null>(null)
  const [tipo, setTipo] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [erros, setErros] = useState<Record<string, string[]>>({})

  const criar = useMutation({
    mutationFn: () => {
      const corpo: Record<string, unknown> = { tipo: Number(tipo), titulo, url: url.trim() }
      if (tiposDocumento) corpo.tipo_documento = tipoDocumento ? Number(tipoDocumento) : null
      return aEditar
        ? pedido<Ligacao[]>(`${base}${aEditar}/`, { method: 'PATCH', json: corpo })
        : pedido<Ligacao[]>(base, { json: corpo })
    },
    onSuccess: (l) => {
      qc.setQueryData(chave, l)
      setAAdicionar(false)
      setAEditar(null)
      setTipo('')
      setTipoDocumento('')
      setTitulo('')
      setUrl('')
      setErros({})
      aoMudar?.()
    },
    onError: (e) => setErros(e instanceof ErroApi ? e.campos : { url: ['Não foi possível gravar.'] }),
  })
  const remover = useMutation({
    mutationFn: (id: number) => pedido<null>(`${base}${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chave })
      aoMudar?.()
    },
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
              {l.tipo_documento_nome && <span className="relacao-tipo">{l.tipo_documento_nome}</span>}
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.titulo} ↗
              </a>
              {podeEditar && (
                <button
                  type="button"
                  className="ligacao-botao"
                  aria-label={`Editar ligação ${l.titulo}`}
                  onClick={() => {
                    setTipo(String(l.tipo))
                    setTipoDocumento(l.tipo_documento ? String(l.tipo_documento) : '')
                    setTitulo(l.titulo)
                    setUrl(l.url)
                    setErros({})
                    setAEditar(l.id)
                    setAAdicionar(true)
                  }}
                >
                  Editar
                </button>
              )}
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
          {tiposDocumento && (
            <CampoSelecao
              rotulo="Documento do negócio"
              vazio="— (nenhum em particular)"
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              opcoes={tiposDocumento.map((t) => ({ valor: t.id, nome: t.nome }))}
              erro={erros.tipo_documento}
            />
          )}
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
            <button
              type="button"
              className="botao-secundario"
              onClick={() => {
                setAAdicionar(false)
                setAEditar(null)
                setTipo('')
                setTipoDocumento('')
                setTitulo('')
                setUrl('')
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="botao-principal" disabled={criar.isPending}>
              {aEditar ? 'Guardar' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
