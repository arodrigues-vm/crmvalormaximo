import { useState, type FormEvent } from 'react'

import { ErroApi, pedido } from '../api/cliente'
import { useSessao } from '../app/sessao'
import { CampoTexto } from '../componentes/campos'

/** «A minha conta»: estado do início de sessão em dois passos e opção de o desligar (D-40). */
export function Conta() {
  const { utilizador, atualizar } = useSessao()
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [feito, setFeito] = useState(false)
  if (!utilizador) return null

  async function desativar(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErro(null)
    try {
      await pedido('/api/auth/mfa/desativar/', { json: { password, codigo } })
      setFeito(true)
      setPassword('')
      setCodigo('')
      await atualizar()
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400 && Object.keys(err.campos).some((k) => k !== 'detail')) {
        setErros(err.campos)
      } else setErro(err instanceof ErroApi ? err.message : 'Não foi possível contactar o servidor.')
    } finally {
      setAGravar(false)
    }
  }

  return (
    <div className="ficha">
      <div className="cabecalho-ficha">
        <div>
          <h2 className="ficha-titulo">A minha conta</h2>
          <p className="ajuda">
            {utilizador.nome} · {utilizador.email} · {utilizador.perfil_nome}
          </p>
        </div>
      </div>
      <section className="bloco">
        <div className="bloco-conteudo">
          <h3>Início de sessão em dois passos</h3>
          {feito && (
            <p className="aviso-duplicados" role="status">
              O início de sessão em dois passos foi desligado. Da próxima vez entra só com o email e a palavra-passe.
            </p>
          )}
          {utilizador.mfa_ativa ? (
            <p>
              <strong>Ativo.</strong> Ao entrar, além da palavra-passe, é pedido o código da aplicação do telemóvel.
            </p>
          ) : (
            !feito && (
              <p>
                <strong>Desligado.</strong> Entra só com o email e a palavra-passe.
              </p>
            )
          )}
          {utilizador.mfa_ativa && utilizador.mfa_obrigatoria && (
            <p className="ajuda">
              É obrigatório para o seu perfil. O Administrador pode torná-lo opcional em{' '}
              <strong>Configurações → Parâmetros</strong>; depois disso, pode desligá-lo aqui.
            </p>
          )}
          {utilizador.mfa_ativa && !utilizador.mfa_obrigatoria && (
            <form className="formulario-dialogo" onSubmit={desativar} noValidate>
              <p className="ajuda">
                Para desligar, confirme a palavra-passe e um código atual da aplicação do telemóvel (ou um código de
                recuperação). Recomendação: mantenha-o ligado, sobretudo nas contas de Administrador.
              </p>
              <div className="grelha-campos">
                <CampoTexto
                  rotulo="Palavra-passe"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  erro={erros.password}
                />
                <CampoTexto
                  rotulo="Código do telemóvel"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  erro={erros.codigo}
                />
              </div>
              {erro && (
                <p className="erro" role="alert">
                  {erro}
                </p>
              )}
              <div className="acoes-bloco">
                <button className="botao-perigo" type="submit" disabled={aGravar || !password || !codigo}>
                  Desligar o início de sessão em dois passos
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
