import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ErroApi, pedido } from '../../api/cliente'
import { CampoSelecao, CampoTexto } from '../../componentes/campos'
import { combinar, obterDisposicao, type BlocoDisposicao, type DefinicaoEcra } from '../../componentes/disposicao'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { ECRAS } from './ecras'

/** Disposição dos ecrãs (D-43): só o Administrador; vale para todos os utilizadores, na edição e na consulta. */
export function Disposicoes() {
  const [modulo, setModulo] = useState(ECRAS[0].modulo)
  // Fica fora do editor: este é recriado depois de guardar.
  const [mensagem, setMensagem] = useState<string | null>(null)
  const def = ECRAS.find((e) => e.modulo === modulo)!
  const { data, isLoading } = useQuery({
    queryKey: ['disposicoes', modulo],
    queryFn: () => obterDisposicao(modulo),
  })
  return (
    <section className="bloco configuracao-lista">
      <div className="bloco-conteudo">
        <h2 className="ficha-titulo">Disposição dos ecrãs</h2>
        <p className="ajuda">
          Escolha a ordem dos separadores, o separador de cada campo e a posição do campo dentro do separador. A
          disposição vale para todos os utilizadores, no ecrã de edição e na ficha de consulta.
        </p>
        <div className="grelha-campos">
          <CampoSelecao
            rotulo="Módulo"
            value={modulo}
            onChange={(e) => {
              setMensagem(null)
              setModulo(e.target.value)
            }}
            opcoes={ECRAS.map((e) => ({ valor: e.modulo, nome: e.nome }))}
          />
        </div>
        {isLoading ? (
          <p className="a-carregar">A carregar…</p>
        ) : (
          <Editor
            key={modulo + JSON.stringify(data?.blocos)}
            def={def}
            guardada={data?.blocos ?? null}
            mensagem={mensagem}
            setMensagem={setMensagem}
          />
        )}
      </div>
    </section>
  )
}

const mover = <T,>(lista: T[], de: number, para: number) => {
  const copia = [...lista]
  const [x] = copia.splice(de, 1)
  copia.splice(para, 0, x)
  return copia
}

interface PropsEditor {
  def: DefinicaoEcra
  guardada: BlocoDisposicao[] | null
  mensagem: string | null
  setMensagem: (m: string | null) => void
}

function Editor({ def, guardada, mensagem, setMensagem }: PropsEditor) {
  const qc = useQueryClient()
  const inicial = combinar(def.padrao, guardada)
  const [blocos, setBlocos] = useState<BlocoDisposicao[]>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const alterado = JSON.stringify(blocos) !== JSON.stringify(inicial)
  const guarda = useGuardaSaida(alterado)

  const depois = (r: { blocos: BlocoDisposicao[] | null }, texto: string) => {
    guarda.libertar()
    qc.setQueryData(['disposicoes', def.modulo], { modulo: def.modulo, blocos: r.blocos })
    setErro(null)
    setMensagem(texto)
  }
  const falhou = (e: unknown) => {
    setMensagem(null)
    setErro(e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Não foi possível gravar.')
  }
  const gravar = useMutation({
    mutationFn: () =>
      pedido<{ blocos: BlocoDisposicao[] }>(`/api/disposicoes/${def.modulo}/`, { method: 'PUT', json: { blocos } }),
    onSuccess: (r) => depois(r, 'Disposição guardada.'),
    onError: falhou,
  })
  const repor = useMutation({
    mutationFn: () => pedido<{ blocos: null }>(`/api/disposicoes/${def.modulo}/`, { method: 'DELETE' }),
    onSuccess: (r) => depois(r, 'Reposta a disposição de origem.'),
    onError: falhou,
  })

  const mudarBloco = (i: number, b: BlocoDisposicao) => {
    setMensagem(null)
    setBlocos((a) => a.map((x, j) => (j === i ? b : x)))
  }
  const moverBloco = (i: number, d: number) => {
    setMensagem(null)
    setBlocos((a) => mover(a, i, i + d))
  }
  const moverCampo = (i: number, k: number, d: number) =>
    mudarBloco(i, { ...blocos[i], campos: mover(blocos[i].campos, k, k + d) })
  const mudarSeparador = (i: number, campo: string, destino: string) => {
    setMensagem(null)
    setBlocos((a) =>
      a.map((b, j) =>
        j === i
          ? { ...b, campos: b.campos.filter((c) => c !== campo) }
          : b.chave === destino
            ? { ...b, campos: [...b.campos, campo] }
            : b,
      ),
    )
  }
  const novoSeparador = () => {
    setMensagem(null)
    let n = 1
    while (blocos.some((b) => b.chave === `separador_${n}`)) n++
    setBlocos((a) => [...a, { chave: `separador_${n}`, titulo: 'Novo separador', campos: [] }])
  }

  return (
    <>
      <ol className="disposicao-blocos">
        {blocos.map((b, i) => (
          <li key={b.chave} className="disposicao-bloco">
            <div className="disposicao-cabeca">
              <CampoTexto
                rotulo={`Separador ${i + 1}`}
                value={b.titulo}
                maxLength={80}
                onChange={(e) => mudarBloco(i, { ...b, titulo: e.target.value })}
              />
              <button
                type="button"
                className="botao-icone"
                aria-label={`Subir o separador ${b.titulo}`}
                disabled={i === 0}
                onClick={() => moverBloco(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="botao-icone"
                aria-label={`Descer o separador ${b.titulo}`}
                disabled={i === blocos.length - 1}
                onClick={() => moverBloco(i, 1)}
              >
                ↓
              </button>
              {b.campos.length === 0 && (
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Remover o separador ${b.titulo}`}
                  onClick={() => setBlocos((a) => a.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </div>
            {b.campos.length === 0 ? (
              <p className="ajuda">Separador vazio: mova campos para aqui ou remova-o.</p>
            ) : (
              <ul className="disposicao-campos">
                {b.campos.map((c, k) => (
                  <li key={c}>
                    <span className="disposicao-campo-nome">{def.rotulos[c] ?? c}</span>
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Subir ${def.rotulos[c] ?? c}`}
                      disabled={k === 0}
                      onClick={() => moverCampo(i, k, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Descer ${def.rotulos[c] ?? c}`}
                      disabled={k === b.campos.length - 1}
                      onClick={() => moverCampo(i, k, 1)}
                    >
                      ↓
                    </button>
                    <select
                      aria-label={`Separador de ${def.rotulos[c] ?? c}`}
                      value={b.chave}
                      onChange={(e) => mudarSeparador(i, c, e.target.value)}
                    >
                      {blocos.map((x) => (
                        <option key={x.chave} value={x.chave}>
                          {x.titulo || '(sem nome)'}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p>
        <button type="button" className="botao-secundario" onClick={novoSeparador}>
          Acrescentar separador
        </button>
      </p>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {mensagem && <p className="ajuda">{mensagem}</p>}
      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          disabled={repor.isPending || (!guardada && !alterado)}
          onClick={() => repor.mutate()}
        >
          Restaurar disposição de origem
        </button>
        <button
          type="button"
          className="botao-principal"
          disabled={gravar.isPending || !alterado || blocos.some((b) => !b.titulo.trim())}
          onClick={() => gravar.mutate()}
        >
          {gravar.isPending ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
      {guarda.dialogo}
    </>
  )
}
