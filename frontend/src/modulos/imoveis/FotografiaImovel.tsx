import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ErroApi } from '../../api/cliente'
import { imoveisApi, urlFotografia, type Imovel } from './api'

/** Fotografia principal do imóvel (uma só, para identificação). Gravada de imediato. */
export function FotografiaImovel({ imovel }: { imovel: Imovel }) {
  const qc = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const aoGravar = (i: Imovel) => {
    qc.setQueryData(['imoveis', String(i.id)], i)
    qc.invalidateQueries({ queryKey: ['imoveis', 'lista'] })
    setErro(null)
  }
  const falha = (e: unknown) =>
    setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Falha ao gravar.')
  const carregar = useMutation({
    mutationFn: (f: File) => imoveisApi.carregarFotografia(imovel.id, f),
    onSuccess: aoGravar,
    onError: falha,
  })
  const remover = useMutation({
    mutationFn: () => imoveisApi.removerFotografia(imovel.id),
    onSuccess: aoGravar,
    onError: falha,
  })
  const podeEditar = imovel.acoes.editar
  const aGravar = carregar.isPending || remover.isPending

  return (
    <div className="fotografia-imovel">
      {imovel.tem_fotografia ? (
        <a href={urlFotografia(imovel.id, imovel.versao)} target="_blank" rel="noopener noreferrer">
          <img src={urlFotografia(imovel.id, imovel.versao)} alt={`Fotografia de ${imovel.referencia}`} />
        </a>
      ) : (
        <div className="fotografia-vazia">Sem fotografia</div>
      )}
      {podeEditar && (
        <div className="fotografia-acoes">
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label="Escolher fotografia"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) carregar.mutate(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="botao-secundario"
            disabled={aGravar}
            onClick={() => entrada.current?.click()}
          >
            {carregar.isPending
              ? 'A carregar…'
              : imovel.tem_fotografia
                ? 'Substituir fotografia'
                : 'Carregar fotografia'}
          </button>
          {imovel.tem_fotografia && (
            <button
              type="button"
              className="botao-secundario"
              disabled={aGravar}
              onClick={() => {
                if (window.confirm('Remover a fotografia principal?')) remover.mutate()
              }}
            >
              Remover
            </button>
          )}
          <small className="ajuda">
            JPEG, PNG ou WebP até 15 MB. As restantes fotografias ficam numa pasta externa (Ligações).
          </small>
        </div>
      )}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
