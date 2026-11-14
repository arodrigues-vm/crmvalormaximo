import { useMutation } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { auth, ErroApi } from '../api/cliente'
import { useSessao } from '../app/sessao'
import { PaginaPublica } from './PaginaPublica'

/** Ecrã obrigatório para perfis com MFA exigida que ainda não a configuraram. */
export function ConfigurarMfa() {
  const { atualizar, sair } = useSessao()
  const [qr, setQr] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [codigos, setCodigos] = useState<string[] | null>(null)

  const configurar = useMutation({ mutationFn: auth.configurarMfa })
  const { mutate: iniciar } = configurar
  // Pedir o segredo uma única vez (o StrictMode executa os efeitos duas vezes em desenvolvimento,
  // o que geraria dois segredos e um QR desatualizado).
  const iniciado = useRef(false)
  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    iniciar()
  }, [iniciar])

  useEffect(() => {
    if (configurar.data) void QRCode.toDataURL(configurar.data.uri, { margin: 1, width: 220 }).then(setQr)
  }, [configurar.data])

  async function ativar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      const r = await auth.ativarMfa(codigo)
      setCodigos(r.codigos_recuperacao)
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível contactar o servidor.')
    }
  }

  if (codigos) {
    return (
      <PaginaPublica titulo="Códigos de recuperação">
        <div className="formulario">
          <p className="ajuda">
            Guarde estes códigos num local seguro. Cada um permite entrar <strong>uma vez</strong> se perder o
            telemóvel. Não voltarão a ser mostrados.
          </p>
          <ul className="codigos-recuperacao">
            {codigos.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button className="botao-principal" onClick={() => void atualizar()}>
            Já guardei os códigos — continuar
          </button>
        </div>
      </PaginaPublica>
    )
  }

  return (
    <PaginaPublica titulo="Ativar verificação em dois passos">
      <form onSubmit={ativar} className="formulario">
        <p className="ajuda">
          O seu perfil exige verificação em dois passos. Instale uma aplicação de autenticação (por exemplo, Google
          Authenticator ou Microsoft Authenticator) e leia este código:
        </p>
        <div className="qr">
          {qr ? <img src={qr} alt="Código QR para a aplicação de autenticação" width={220} height={220} /> : '…'}
        </div>
        {configurar.data && (
          <p className="ajuda">
            Ou introduza manualmente: <code className="segredo">{configurar.data.segredo}</code>
          </p>
        )}
        <label>
          Código de 6 dígitos
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        {(erro || configurar.isError) && (
          <p className="erro" role="alert">
            {erro ?? 'Não foi possível iniciar a configuração.'}
          </p>
        )}
        <button className="botao-principal" type="submit" disabled={codigo.trim().length < 6}>
          Ativar
        </button>
        <button type="button" className="botao-secundario" onClick={() => void sair()}>
          Sair
        </button>
      </form>
    </PaginaPublica>
  )
}
