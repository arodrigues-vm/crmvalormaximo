import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ErroApi, pedido } from '../../api/cliente'
import { CampoSelecao, CampoTexto } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import {
  combinar,
  obterCampos,
  obterDisposicao,
  padraoCom,
  type BlocoDisposicao,
  type CampoPersonalizadoDef,
  type DefinicaoEcra,
  type RespostaCampos,
  type RespostaDisposicao,
} from '../../componentes/disposicao'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { ECRAS } from './ecras'

const mensagemErro = (e: unknown) =>
  e instanceof ErroApi ? Object.values(e.campos).flat().join(' ') || e.message : 'Não foi possível gravar.'

/** Disposição dos ecrãs (D-43) e campos/nomes configuráveis (D-44): só o Administrador; vale para todos os
 * utilizadores, no ecrã de edição e na ficha de consulta. */
export function Disposicoes() {
  const [modulo, setModulo] = useState(ECRAS[0].modulo)
  // Fica fora do editor: este é recriado depois de guardar.
  const [mensagem, setMensagem] = useState<string | null>(null)
  const def = ECRAS.find((e) => e.modulo === modulo)!
  const disp = useQuery({ queryKey: ['disposicoes', modulo], queryFn: () => obterDisposicao(modulo) })
  const campos = useQuery({
    queryKey: ['campos-personalizados', modulo],
    queryFn: () => obterCampos(modulo),
    enabled: !def.semPersonalizados,
  })
  const aCarregar = disp.isLoading || (!def.semPersonalizados && campos.isLoading)
  return (
    <section className="bloco configuracao-lista">
      <div className="bloco-conteudo">
        <h2 className="ficha-titulo">Disposição dos ecrãs</h2>
        <p className="ajuda">
          Escolha a ordem dos separadores, o separador de cada campo e a sua posição, mude os nomes e acrescente campos
          novos. Vale para todos os utilizadores, no ecrã de edição e na ficha de consulta.
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
        {aCarregar ? (
          <p className="a-carregar">A carregar…</p>
        ) : (
          <Editor
            key={modulo + JSON.stringify(disp.data) + JSON.stringify(campos.data?.campos ?? [])}
            def={def}
            guardada={disp.data}
            campos={campos.data}
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
  guardada?: RespostaDisposicao
  campos?: RespostaCampos
  mensagem: string | null
  setMensagem: (m: string | null) => void
}

function Editor({ def, guardada, campos, mensagem, setMensagem }: PropsEditor) {
  const qc = useQueryClient()
  const todos = campos?.campos ?? []
  const ativos = todos.filter((c) => c.ativo)
  const inicial = {
    blocos: combinar(padraoCom(def, ativos), guardada?.blocos),
    rotulos: guardada?.rotulos ?? {},
  }
  const [blocos, setBlocos] = useState<BlocoDisposicao[]>(inicial.blocos)
  const [rotulos, setRotulos] = useState<Record<string, string>>(inicial.rotulos)
  const [erro, setErro] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<null | 'novo' | CampoPersonalizadoDef>(null)
  const alterado = JSON.stringify({ blocos, rotulos }) !== JSON.stringify(inicial)
  const guarda = useGuardaSaida(alterado)
  const nomeDe = (c: string) => todos.find((x) => x.chave === c)?.nome ?? def.rotulos[c] ?? c

  const url = `/api/disposicoes/${def.modulo}/`
  const depois = (r: RespostaDisposicao, texto: string) => {
    guarda.libertar()
    qc.setQueryData(['disposicoes', def.modulo], r)
    setErro(null)
    setMensagem(texto)
  }
  const falhou = (e: unknown) => {
    setMensagem(null)
    setErro(mensagemErro(e))
  }
  const gravar = useMutation({
    mutationFn: () => pedido<RespostaDisposicao>(url, { method: 'PUT', json: { blocos, rotulos } }),
    onSuccess: (r) => depois(r, 'Disposição guardada.'),
    onError: falhou,
  })
  const repor = useMutation({
    mutationFn: () => pedido<RespostaDisposicao>(url, { method: 'DELETE' }),
    onSuccess: (r) => depois(r, 'Reposta a disposição de origem (ordem, separadores e nomes).'),
    onError: falhou,
  })

  const limpar = () => setMensagem(null)
  const mudarBloco = (i: number, b: BlocoDisposicao) => {
    limpar()
    setBlocos((a) => a.map((x, j) => (j === i ? b : x)))
  }
  const moverBloco = (i: number, d: number) => {
    limpar()
    setBlocos((a) => mover(a, i, i + d))
  }
  const moverCampo = (i: number, k: number, d: number) =>
    mudarBloco(i, { ...blocos[i], campos: mover(blocos[i].campos, k, k + d) })
  const mudarSeparador = (i: number, campo: string, destino: string) => {
    limpar()
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
    limpar()
    let n = 1
    while (blocos.some((b) => b.chave === `separador_${n}`)) n++
    setBlocos((a) => [...a, { chave: `separador_${n}`, titulo: 'Novo separador', campos: [] }])
  }
  const renomear = (c: string, nome: string) => {
    limpar()
    setRotulos((a) => {
      const n = { ...a }
      if (nome.trim()) n[c] = nome
      else delete n[c]
      return n
    })
  }

  /** Depois de criar um campo, coloca-o no separador escolhido e guarda a disposição. */
  async function colocarCampoNovo(c: CampoPersonalizadoDef, separador: string) {
    const novos = blocos.map((b) => (b.chave === separador ? { ...b, campos: [...b.campos, c.chave] } : b))
    const r = await pedido<RespostaDisposicao>(url, { method: 'PUT', json: { blocos: novos, rotulos } })
    guarda.libertar()
    qc.setQueryData(['disposicoes', def.modulo], r)
    await qc.invalidateQueries({ queryKey: ['campos-personalizados', def.modulo] })
    setMensagem(
      c.lista
        ? `Campo «${c.nome}» criado. Acrescente as opções em Configurações → Listas de valores, na lista «${c.nome}».`
        : `Campo «${c.nome}» criado.`,
    )
  }

  const inativos = todos.filter((c) => !c.ativo)
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
                {b.campos.map((c, k) => {
                  const cp = todos.find((x) => x.chave === c)
                  const original = def.rotulos[c] ?? c
                  return (
                    <li key={c}>
                      {cp ? (
                        <span className="disposicao-campo-nome">
                          {cp.nome} <small className="etiqueta etiqueta-neutra">{cp.tipo_nome}</small>{' '}
                          <button
                            type="button"
                            className="ligacao-botao"
                            disabled={alterado}
                            title={alterado ? 'Guarde primeiro a disposição.' : undefined}
                            onClick={() => setDialogo(cp)}
                          >
                            Editar campo
                          </button>
                        </span>
                      ) : (
                        <input
                          className="disposicao-campo-nome"
                          aria-label={`Nome de ${original}`}
                          placeholder={original}
                          maxLength={80}
                          value={rotulos[c] ?? ''}
                          onChange={(e) => renomear(c, e.target.value)}
                        />
                      )}
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Subir ${nomeDe(c)}`}
                        disabled={k === 0}
                        onClick={() => moverCampo(i, k, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Descer ${nomeDe(c)}`}
                        disabled={k === b.campos.length - 1}
                        onClick={() => moverCampo(i, k, 1)}
                      >
                        ↓
                      </button>
                      <select
                        aria-label={`Separador de ${nomeDe(c)}`}
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
                  )
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p className="ajuda">
        Para mudar o nome de um campo, escreva o novo nome na caixa do campo (vazia = nome de origem). Só muda o nome
        apresentado; os dados não mudam.
      </p>
      <div className="acoes-bloco">
        <button type="button" className="botao-secundario" onClick={novoSeparador}>
          Acrescentar separador
        </button>
        {!def.semPersonalizados && (
          <button
            type="button"
            className="botao-secundario"
            disabled={alterado}
            title={alterado ? 'Guarde primeiro a disposição.' : undefined}
            onClick={() => setDialogo('novo')}
          >
            Acrescentar campo
          </button>
        )}
      </div>
      {alterado && !def.semPersonalizados && (
        <p className="ajuda">Guarde (ou restaure) a disposição antes de acrescentar ou alterar campos.</p>
      )}
      {inativos.length > 0 && (
        <div className="disposicao-bloco">
          <strong>Campos desativados</strong>
          <p className="ajuda">Não aparecem nos ecrãs, mas os valores já gravados ficam guardados.</p>
          <ul className="disposicao-campos">
            {inativos.map((c) => (
              <li key={c.chave}>
                <span className="disposicao-campo-nome">
                  {c.nome} <small className="etiqueta etiqueta-neutra">{c.tipo_nome}</small>
                </span>
                <button type="button" className="ligacao-botao" disabled={alterado} onClick={() => setDialogo(c)}>
                  Editar campo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
          disabled={repor.isPending || (!guardada?.blocos && !Object.keys(rotulos).length && !alterado)}
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
      {dialogo && campos && (
        <DialogoCampo
          def={def}
          campo={dialogo === 'novo' ? null : dialogo}
          opcoes={campos}
          blocos={blocos}
          aoFechar={() => setDialogo(null)}
          aoCriar={colocarCampoNovo}
          aoAlterar={async (texto) => {
            await qc.invalidateQueries({ queryKey: ['campos-personalizados', def.modulo] })
            setMensagem(texto)
          }}
        />
      )}
      {guarda.dialogo}
    </>
  )
}

const SIM_NAO = [
  { valor: 'nao', nome: 'Não' },
  { valor: 'sim', nome: 'Sim' },
]

function DialogoCampo({
  def,
  campo,
  opcoes,
  blocos,
  aoFechar,
  aoCriar,
  aoAlterar,
}: {
  def: DefinicaoEcra
  campo: CampoPersonalizadoDef | null
  opcoes: RespostaCampos
  blocos: BlocoDisposicao[]
  aoFechar: () => void
  aoCriar: (c: CampoPersonalizadoDef, separador: string) => Promise<void>
  aoAlterar: (texto: string) => Promise<void>
}) {
  const [v, setV] = useState({
    nome: campo?.nome ?? '',
    tipo: campo?.tipo ?? 'texto',
    modulo_relacao: campo?.modulo_relacao ?? '',
    obrigatorio: campo?.obrigatorio ? 'sim' : 'nao',
    ajuda: campo?.ajuda ?? '',
    separador: blocos[0]?.chave ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const mudar = (k: keyof typeof v, x: string) => setV((a) => ({ ...a, [k]: x }))
  const relacao = v.tipo === 'relacao' || v.tipo === 'relacao_multipla'

  async function executar(acao: () => Promise<void>) {
    setAGravar(true)
    setErro(null)
    try {
      await acao()
      aoFechar()
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setAGravar(false)
    }
  }
  const guardar = () =>
    executar(async () => {
      if (campo) {
        await pedido(`/api/campos-personalizados/${campo.id}/`, {
          method: 'PATCH',
          json: { nome: v.nome, obrigatorio: v.obrigatorio === 'sim', ajuda: v.ajuda },
        })
        await aoAlterar(`Campo «${v.nome}» alterado.`)
      } else {
        const c = await pedido<CampoPersonalizadoDef>('/api/campos-personalizados/', {
          method: 'POST',
          json: {
            ecra: def.modulo,
            nome: v.nome,
            tipo: v.tipo,
            modulo_relacao: relacao ? v.modulo_relacao : '',
            obrigatorio: v.obrigatorio === 'sim',
            ajuda: v.ajuda,
          },
        })
        await aoCriar(c, v.separador)
      }
    })
  const ativar = (ativo: boolean) =>
    executar(async () => {
      await pedido(`/api/campos-personalizados/${campo!.id}/`, { method: 'PATCH', json: { ativo } })
      await aoAlterar(ativo ? `Campo «${campo!.nome}» reativado.` : `Campo «${campo!.nome}» desativado.`)
    })
  const remover = () =>
    executar(async () => {
      await pedido(`/api/campos-personalizados/${campo!.id}/`, { method: 'DELETE' })
      await aoAlterar(`Campo «${campo!.nome}» removido.`)
    })

  return (
    <Dialogo
      titulo={campo ? `Editar campo «${campo.nome}»` : 'Acrescentar campo'}
      aberto
      aoFechar={aoFechar}
      acoes={
        <>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          {campo && campo.em_uso === 0 && (
            <button type="button" className="botao-perigo" disabled={aGravar} onClick={remover}>
              Remover
            </button>
          )}
          {campo && (
            <button type="button" className="botao-secundario" disabled={aGravar} onClick={() => ativar(!campo.ativo)}>
              {campo.ativo ? 'Desativar' : 'Reativar'}
            </button>
          )}
          <button type="button" className="botao-principal" disabled={aGravar || !v.nome.trim()} onClick={guardar}>
            {campo ? 'Guardar' : 'Criar campo'}
          </button>
        </>
      }
    >
      <div className="formulario-dialogo">
        <CampoTexto
          rotulo="Nome do campo"
          required
          maxLength={80}
          value={v.nome}
          onChange={(e) => mudar('nome', e.target.value)}
        />
        {campo ? (
          <p className="ajuda">
            Tipo: <strong>{campo.tipo_nome}</strong>
            {campo.modulo_relacao &&
              ` (${opcoes.modulos.find((m) => m.valor === campo.modulo_relacao)?.nome ?? campo.modulo_relacao})`}
            . O tipo não muda depois de criado, para não estragar os valores já gravados.
            {campo.em_uso ? ` Tem valores em ${campo.em_uso} registo(s): pode desativá-lo, mas não removê-lo.` : ''}
          </p>
        ) : (
          <>
            <CampoSelecao
              rotulo="Tipo de campo"
              value={v.tipo}
              onChange={(e) => mudar('tipo', e.target.value)}
              opcoes={opcoes.tipos}
              ajuda="Não pode ser alterado depois."
            />
            {relacao && (
              <CampoSelecao
                rotulo="Liga a registos de"
                vazio="—"
                value={v.modulo_relacao}
                onChange={(e) => mudar('modulo_relacao', e.target.value)}
                opcoes={opcoes.modulos}
              />
            )}
            <CampoSelecao
              rotulo="Separador"
              value={v.separador}
              onChange={(e) => mudar('separador', e.target.value)}
              opcoes={blocos.map((b) => ({ valor: b.chave, nome: b.titulo }))}
            />
          </>
        )}
        {campo?.lista && (
          <p className="ajuda">
            As opções editam-se em <Link to="/configuracoes/listas">Listas de valores</Link>, na lista «{campo.nome}».
          </p>
        )}
        <CampoSelecao
          rotulo="Preenchimento obrigatório"
          value={v.obrigatorio}
          onChange={(e) => mudar('obrigatorio', e.target.value)}
          opcoes={SIM_NAO}
          ajuda="Os registos já existentes só o exigem quando forem editados."
        />
        <CampoTexto
          rotulo="Texto de ajuda (opcional)"
          maxLength={200}
          value={v.ajuda}
          onChange={(e) => mudar('ajuda', e.target.value)}
        />
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Dialogo>
  )
}
