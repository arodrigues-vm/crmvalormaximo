import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { GRUPOS } from './modulos'
import { useSessao } from './sessao'

/** Módulo da página atual: o de caminho mais comprido que corresponde (ex.: /visitas/interesses é o
 * Seguimento Compradores, não as Visitas). */
function moduloAtual(caminho: string) {
  let melhor: (typeof GRUPOS)[number]['modulos'][number] | null = null
  for (const grupo of GRUPOS) {
    for (const modulo of grupo.modulos) {
      const corresponde =
        modulo.caminho === caminho || (modulo.caminho !== '/' && caminho.startsWith(`${modulo.caminho}/`))
      if (corresponde && (!melhor || modulo.caminho.length > melhor.caminho.length)) melhor = modulo
    }
  }
  return melhor
}

export function Layout({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()
  const atual = moduloAtual(pathname)
  const { utilizador, sair, pode } = useSessao()
  const grupos = GRUPOS.map((g) => ({ ...g, modulos: g.modulos.filter((m) => pode(m.permissao ?? m.chave)) })).filter(
    (g) => g.modulos.length > 0,
  )

  return (
    <div className="estrutura">
      <aside className={`lateral ${menuAberto ? 'aberta' : ''}`} aria-label="Navegação principal">
        <div className="marca">
          <img src="/marca/logotipo-320.webp" alt="Valor Máximo — Soluções Imobiliárias" width={150} height={117} />
        </div>
        <nav>
          {grupos.map((grupo) => (
            <div key={grupo.nome} className="grupo">
              <p className="grupo-nome">{grupo.nome}</p>
              <ul>
                {grupo.modulos.map((modulo) => (
                  <li key={modulo.chave}>
                    {modulo.disponivel ? (
                      <NavLink
                        to={modulo.caminho}
                        className={() => (atual?.chave === modulo.chave ? 'active' : '')}
                        onClick={() => setMenuAberto(false)}
                      >
                        {modulo.nome}
                      </NavLink>
                    ) : (
                      <span className="indisponivel" title="Em desenvolvimento">
                        {modulo.nome}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      {menuAberto && <div className="sombra" onClick={() => setMenuAberto(false)} />}
      <div className="conteudo">
        <header className="cabecalho">
          <button
            className="botao-menu"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((v) => !v)}
          >
            ☰
          </button>
          <h1>{atual?.nome ?? 'CRM Valor Máximo'}</h1>
          {utilizador && (
            <div className="utilizador">
              <Link to="/conta" className="utilizador-nome" title="A minha conta">
                {utilizador.nome}
                <small>{utilizador.perfil_nome}</small>
              </Link>
              <button className="botao-secundario" onClick={() => void sair()}>
                Sair
              </button>
            </div>
          )}
        </header>
        <main className="principal">{children}</main>
      </div>
    </div>
  )
}
