import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { auth, ErroApi } from '../api/cliente'
import { PaginaPublica } from './PaginaPublica'

export function PedirRecuperacao() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      await auth.recuperar(email)
      setEnviado(true)
    } catch (err) {
      setErro(
        err instanceof ErroApi && err.estado === 429
          ? 'Demasiados pedidos. Tente novamente mais tarde.'
          : 'Não foi possível enviar o pedido.',
      )
    }
  }

  return (
    <PaginaPublica titulo="Recuperar acesso">
      {enviado ? (
        <div className="formulario">
          <p>
            Se existir uma conta com esse email, receberá uma mensagem com as instruções para definir uma nova
            palavra-passe.
          </p>
          <Link to="/entrar" className="ligacao-secundaria">
            Voltar a entrar
          </Link>
        </div>
      ) : (
        <form onSubmit={submeter} className="formulario">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <button className="botao-principal" type="submit" disabled={!email}>
            Enviar instruções
          </button>
          <Link to="/entrar" className="ligacao-secundaria">
            Voltar a entrar
          </Link>
        </form>
      )}
    </PaginaPublica>
  )
}

export function DefinirPassword() {
  const { uid = '', token = '' } = useParams()
  const navegar = useNavigate()
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function submeter(e: FormEvent) {
    e.preventDefault()
    if (nova !== confirmacao) {
      setErro('As palavras-passe não coincidem.')
      return
    }
    setErro(null)
    try {
      await auth.confirmar(uid, token, nova)
      navegar('/entrar', { replace: true, state: { mensagem: 'Palavra-passe alterada.' } })
    } catch (err) {
      if (err instanceof ErroApi) {
        setErro(err.campos.nova_password?.join(' ') || err.message)
      } else {
        setErro('Não foi possível contactar o servidor.')
      }
    }
  }

  return (
    <PaginaPublica titulo="Definir nova palavra-passe">
      <form onSubmit={submeter} className="formulario">
        <label>
          Nova palavra-passe
          <input
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            required
            minLength={12}
          />
        </label>
        <label>
          Confirmar palavra-passe
          <input
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
        </label>
        <p className="ajuda">Mínimo de 12 caracteres; evite palavras comuns ou só números.</p>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <button className="botao-principal" type="submit" disabled={!nova || !confirmacao}>
          Guardar
        </button>
      </form>
    </PaginaPublica>
  )
}
