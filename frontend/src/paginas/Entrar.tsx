import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { ErroApi } from '../api/cliente'
import { useSessao } from '../app/sessao'
import { PaginaPublica } from './PaginaPublica'

export function Entrar() {
  const { utilizador, entrar, verificarMfa } = useSessao()
  const [passoMfa, setPassoMfa] = useState(false)
  const [codigo, setCodigo] = useState('')
  const local = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  const destino = (local.state as { de?: string } | null)?.de ?? '/'
  if (utilizador) return <Navigate to={destino} replace />

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setAEnviar(true)
    try {
      if (passoMfa) {
        await verificarMfa(codigo)
      } else if ((await entrar(email, password)) === 'mfa') {
        setPassoMfa(true)
      }
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 429) {
        setErro('Demasiadas tentativas. Aguarde um minuto e tente novamente.')
      } else if (err instanceof ErroApi && err.estado === 400) {
        setErro(err.message)
        if (err.message.includes('expirou')) {
          setPassoMfa(false)
          setCodigo('')
        }
      } else {
        setErro('Não foi possível contactar o servidor.')
      }
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <PaginaPublica titulo={passoMfa ? 'Verificação em dois passos' : 'Entrar'}>
      {passoMfa ? (
        <form onSubmit={submeter} className="formulario" noValidate>
          <p className="ajuda">
            Introduza o código de 6 dígitos da aplicação de autenticação, ou um dos seus códigos de recuperação.
          </p>
          <label>
            Código
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoFocus
            />
          </label>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <button className="botao-principal" type="submit" disabled={aEnviar || codigo.trim().length < 6}>
            {aEnviar ? 'A verificar…' : 'Confirmar'}
          </button>
        </form>
      ) : (
        <form onSubmit={submeter} className="formulario" noValidate>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Palavra-passe
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <button className="botao-principal" type="submit" disabled={aEnviar || !email || !password}>
            {aEnviar ? 'A entrar…' : 'Entrar'}
          </button>
          <Link to="/recuperar" className="ligacao-secundaria">
            Esqueceu-se da palavra-passe?
          </Link>
        </form>
      )}
    </PaginaPublica>
  )
}
