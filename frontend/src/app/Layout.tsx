import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { GRUPOS } from './modulos'

function nomeModuloAtual(caminho: string): string {
  for (const grupo of GRUPOS) {
    for (const modulo of grupo.modulos) {
      if (modulo.caminho === caminho || (modulo.caminho !== '/' && caminho.startsWith(modulo.caminho))) {
        return modulo.nome
      }
    }
  }
  return 'CRM Valor Máximo'
}

export function Layout({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="estrutura">
      <aside className={`lateral ${menuAberto ? 'aberta' : ''}`} aria-label="Navegação principal">
        <div className="marca">
          <span className="marca-logo" aria-hidden="true">
            VM
          </span>
          <span className="marca-texto">
            <strong>Valor Máximo</strong>
            <small>Soluções Imobiliárias</small>
          </span>
        </div>
        <nav>
          {GRUPOS.map((grupo) => (
            <div key={grupo.nome} className="grupo">
              <p className="grupo-nome">{grupo.nome}</p>
              <ul>
                {grupo.modulos.map((modulo) => (
                  <li key={modulo.chave}>
                    {modulo.disponivel ? (
                      <NavLink to={modulo.caminho} end={modulo.caminho === '/'} onClick={() => setMenuAberto(false)}>
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
          <h1>{nomeModuloAtual(pathname)}</h1>
        </header>
        <main className="principal">{children}</main>
      </div>
    </div>
  )
}
