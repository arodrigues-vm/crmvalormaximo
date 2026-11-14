import { useId, useState, type ReactNode } from 'react'

interface Props {
  titulo: string
  /** Uma função só é chamada com o bloco aberto (carregamento diferido, ex.: histórico). */
  children: ReactNode | ((aberto: boolean) => ReactNode)
  /** Blocos principais abertos; secundários recolhidos (Especificação §6). */
  abertoInicial?: boolean
  /** Força a abertura (por exemplo, quando contém erros de validação). */
  forcarAberto?: boolean
  resumo?: ReactNode
}

/** Secção expansível/recolhível. O conteúdo recolhido mantém-se montado (valores preservados). */
export function Bloco({ titulo, children, abertoInicial = true, forcarAberto = false, resumo }: Props) {
  const [aberto, setAberto] = useState(abertoInicial)
  const id = useId()
  // Abrir no mesmo render em que surgem erros (sem passar por um render com o bloco fechado).
  const [forcadoAntes, setForcadoAntes] = useState(forcarAberto)
  if (forcarAberto !== forcadoAntes) {
    setForcadoAntes(forcarAberto)
    if (forcarAberto) setAberto(true)
  }

  return (
    <section className={`bloco ${aberto ? 'aberto' : 'recolhido'}`}>
      <h2 className="bloco-titulo">
        <button type="button" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((v) => !v)}>
          <span className="bloco-seta" aria-hidden="true">
            ▸
          </span>
          {titulo}
          {!aberto && resumo && <span className="bloco-resumo">{resumo}</span>}
        </button>
      </h2>
      <div id={id} className="bloco-conteudo" hidden={!aberto}>
        {typeof children === 'function' ? aberto && children(aberto) : children}
      </div>
    </section>
  )
}
