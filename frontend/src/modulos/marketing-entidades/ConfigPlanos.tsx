import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ErroApi } from '../../api/cliente'
import { CampoAreaTexto, CampoMultiplo, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { equipaApi } from '../equipa/api'
import { procurarConcelhos } from '../procuras/api'
import { planosEntidadesApi, type Criterios, type Passo, type PlanoEntidades } from './api'

/** Configurações → Marketing de Entidades (D-04, D-55): o CRM nasce sem planos; o Administrador cria-os aqui. */
export function ConfigPlanos() {
  const { data = [], isLoading } = useQuery({ queryKey: ['planos-entidades'], queryFn: planosEntidadesApi.listar })
  const opcoes = useQuery({ queryKey: ['planos-entidades', 'opcoes'], queryFn: planosEntidadesApi.opcoes })
  const [aEditar, setAEditar] = useState<PlanoEntidades | 'novo' | null>(null)
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (aEditar)
    return (
      <EditorPlano
        key={aEditar === 'novo' ? 'novo' : aEditar.id}
        plano={aEditar === 'novo' ? undefined : aEditar}
        aoFechar={() => setAEditar(null)}
      />
    )
  const nomeFund = (f: string) => opcoes.data?.fundamentos.find((x) => x.valor === f)?.nome ?? f
  return (
    <section className="bloco configuracao-lista">
      <div className="bloco-conteudo">
        <h2 className="ficha-titulo">Planos de Marketing de Entidades</h2>
        <p className="ajuda">
          O CRM não traz planos, públicos nem tarefas de marketing instalados: crie aqui os seus. Cada plano tem um
          público (critérios), um fundamento de proteção de dados, tarefas com prazo e, se quiser, gatilhos que o
          iniciam sozinho. A escolha do fundamento deve ser validada pelo responsável de proteção de dados.
        </p>
        {data.length === 0 && <p className="vazio-lista">Ainda não há planos.</p>}
        <ul className="lista-relacoes">
          {data.map((p) => (
            <li key={p.id}>
              <strong>{p.nome}</strong>
              <span className="relacao-tipo">{nomeFund(p.fundamento).split(' (')[0]}</span>
              <small className="ajuda">
                {p.passos.filter((x) => x.ativo).length} tarefas ·{' '}
                {p.gatilhos.length ? `${p.gatilhos.length} gatilho(s)` : 'sem gatilhos'}
              </small>
              {!p.ativo && <span className="etiqueta etiqueta-neutra">Inativo</span>}
              <button type="button" className="ligacao-botao" onClick={() => setAEditar(p)}>
                Editar
              </button>
            </li>
          ))}
        </ul>
        {opcoes.data?.pode_configurar && (
          <button type="button" className="botao-secundario" onClick={() => setAEditar('novo')}>
            + Novo plano
          </button>
        )}
      </div>
    </section>
  )
}

const PASSO_VAZIO: Passo = {
  nome: '',
  descricao: '',
  dias: 0,
  periodicidade_dias: null,
  responsavel: null,
  ativo: true,
}

function EditorPlano({ plano, aoFechar }: { plano?: PlanoEntidades; aoFechar: () => void }) {
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['planos-entidades', 'opcoes'], queryFn: planosEntidadesApi.opcoes })
  const pessoas = useQuery({
    queryKey: ['equipa', 'responsaveis', 'marketing-entidades'],
    queryFn: () => equipaApi.responsaveis('marketing-entidades'),
  })
  const [v, setV] = useState({
    nome: plano?.nome ?? '',
    descricao: plano?.descricao ?? '',
    objetivo: plano?.objetivo ?? '',
    fundamento: plano?.fundamento ?? '',
    ativo: plano?.ativo ?? true,
    gatilhos: plano?.gatilhos ?? [],
  })
  const [criterios, setCriterios] = useState<Criterios>(plano?.criterios ?? {})
  const [concelhos, setConcelhos] = useState<OpcaoPesquisa[]>(
    (plano?.criterios_nomes.concelhos ?? []).map((c) => ({ id: c.id, titulo: c.nome })),
  )
  const [novoConcelho, setNovoConcelho] = useState<OpcaoPesquisa | null>(null)
  const [passos, setPassos] = useState<Passo[]>(plano?.passos.filter((p) => p.ativo) ?? [])
  const [erros, setErros] = useState<Record<string, unknown>>({})
  const o = opcoes.data
  const gatilhos = o?.gatilhos ?? []
  const publico = useQuery({
    queryKey: ['planos-entidades', plano?.id, 'publico'],
    queryFn: () => planosEntidadesApi.publico(plano!.id),
    enabled: !!plano,
  })
  const gravar = useMutation({
    mutationFn: () => {
      const corpo = {
        ...v,
        criterios: { ...criterios, concelhos: concelhos.map((c) => c.id) },
        passos: passos.map((p) => ({ ...p, responsavel_nome: undefined })),
      }
      return plano ? planosEntidadesApi.atualizar(plano.id, corpo) : planosEntidadesApi.criar(corpo)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planos-entidades'] })
      aoFechar()
    },
    onError: (e) => setErros(e instanceof ErroApi ? e.campos : { nome: ['Não foi possível gravar.'] }),
  })
  const erro = (k: string) => {
    const x = erros[k]
    return x ? (Array.isArray(x) ? x.map(String) : [JSON.stringify(x)]) : undefined
  }
  const mudarPasso = (i: number, d: Partial<Passo>) =>
    setPassos((ps) => ps.map((p, j) => (j === i ? { ...p, ...d } : p)))
  const mover = (i: number, d: -1 | 1) =>
    setPassos((ps) => {
      const n = [...ps]
      const [x] = n.splice(i, 1)
      n.splice(i + d, 0, x)
      return n
    })
  const multiplo = (k: keyof Criterios, rotulo: string, lista: { id: number; nome: string }[] = []) => (
    <CampoMultiplo
      rotulo={rotulo}
      opcoes={lista}
      valores={criterios[k] ?? []}
      aoMudar={(x) => setCriterios((c) => ({ ...c, [k]: x }))}
    />
  )
  function submeter(e: FormEvent) {
    e.preventDefault()
    setErros({})
    gravar.mutate()
  }
  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <h2 className="ficha-titulo">
        {plano ? `Editar plano «${plano.nome}»` : 'Novo plano de marketing de entidades'}
      </h2>
      <section className="bloco">
        <div className="bloco-conteudo grelha-campos">
          <CampoTexto
            rotulo="Nome"
            required
            value={v.nome}
            onChange={(e) => setV({ ...v, nome: e.target.value })}
            erro={erro('nome')}
          />
          <CampoSelecao
            rotulo="Fundamento (proteção de dados)"
            required
            vazio="— escolha —"
            value={v.fundamento}
            onChange={(e) => setV({ ...v, fundamento: e.target.value })}
            opcoes={(o?.fundamentos ?? []).map((x) => ({ valor: x.valor, nome: x.nome }))}
            erro={erro('fundamento')}
            ajuda="A oposição a marketing exclui sempre a entidade. Nenhum consentimento é presumido."
          />
          <CampoSelecao
            rotulo="Estado"
            value={v.ativo ? 'sim' : 'nao'}
            onChange={(e) => setV({ ...v, ativo: e.target.value === 'sim' })}
            opcoes={[
              { valor: 'sim', nome: 'Ativo' },
              { valor: 'nao', nome: 'Inativo (não inicia em ninguém)' },
            ]}
          />
          <CampoAreaTexto
            rotulo="Objetivo"
            value={v.objetivo}
            onChange={(e) => setV({ ...v, objetivo: e.target.value })}
          />
          <CampoAreaTexto
            rotulo="Descrição"
            value={v.descricao}
            onChange={(e) => setV({ ...v, descricao: e.target.value })}
          />
        </div>
      </section>

      <section className="bloco">
        <div className="bloco-conteudo">
          <h3>Público-alvo</h3>
          <p className="ajuda">Sem critérios = todas as entidades. Em cada critério, basta cumprir um dos valores.</p>
          <div className="grelha-campos">
            {multiplo('papeis', 'Tipo de cliente', o?.papeis)}
            {multiplo('status', 'Status', o?.status)}
            {multiplo('origens', 'Origem do contacto', o?.origens)}
            {multiplo('zonas', 'Zona', o?.zonas)}
            <div className="campo">
              <SeletorPesquisavel
                rotulo="Concelhos"
                chave="concelhos"
                procurar={procurarConcelhos}
                valor={novoConcelho}
                excluir={concelhos.map((c) => c.id)}
                aoMudar={(c) => {
                  if (c) {
                    setConcelhos((x) => [...x, c])
                    setNovoConcelho(null)
                  }
                }}
              />
              <div className="fichas-escolhidas">
                {concelhos.map((c) => (
                  <span key={c.id} className="pilula">
                    {c.titulo}
                    <button
                      type="button"
                      className="ligacao-botao"
                      aria-label={`Retirar ${c.titulo}`}
                      onClick={() => setConcelhos((x) => x.filter((y) => y.id !== c.id))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          {erro('criterios') && <p className="erro">{erro('criterios')!.join(' ')}</p>}
          {publico.data && (
            <p className="ajuda" aria-label="Pré-visualização do público">
              Público guardado: <strong>{publico.data.total}</strong> entidades · autorizadas pelo RGPD:{' '}
              <strong>{publico.data.autorizadas}</strong> (oposição: {publico.data.oposicao}; sem consentimento:{' '}
              {publico.data.sem_consentimento}) · já no plano: {publico.data.ja_inscritas}.
            </p>
          )}
        </div>
      </section>

      <section className="bloco">
        <div className="bloco-conteudo">
          <h3>Gatilhos</h3>
          <CampoMultiplo
            rotulo="Iniciar o plano sozinho quando…"
            opcoes={gatilhos.map((g, i) => ({ id: i + 1, nome: g.nome }))}
            valores={gatilhos.flatMap((g, i) => (v.gatilhos.includes(g.valor) ? [i + 1] : []))}
            aoMudar={(ids) => setV({ ...v, gatilhos: ids.map((i) => gatilhos[i - 1].valor) })}
            ajuda="Nenhum por omissão. Só inicia em entidades do público e autorizadas pelo RGPD."
          />
        </div>
      </section>

      <section className="bloco">
        <div className="bloco-conteudo">
          <h3>Tarefas do plano</h3>
          <p className="ajuda">
            Prazo em dias depois do início. Com periodicidade, ao concluir a tarefa o CRM cria a seguinte. Mudar as
            tarefas aqui não altera as tarefas já criadas.
          </p>
          {passos.map((p, i) => (
            <fieldset key={p.id ?? `n${i}`} className="passo-plano">
              <legend>Tarefa {i + 1}</legend>
              <div className="grelha-campos">
                <CampoTexto
                  rotulo="Nome da tarefa"
                  value={p.nome}
                  onChange={(e) => mudarPasso(i, { nome: e.target.value })}
                />
                <CampoTexto
                  rotulo="Prazo (dias depois do início)"
                  type="number"
                  min={0}
                  value={String(p.dias)}
                  onChange={(e) => mudarPasso(i, { dias: Number(e.target.value) })}
                />
                <CampoTexto
                  rotulo="Repetir de N em N dias"
                  type="number"
                  min={1}
                  value={p.periodicidade_dias ? String(p.periodicidade_dias) : ''}
                  placeholder="Não repete"
                  onChange={(e) =>
                    mudarPasso(i, { periodicidade_dias: e.target.value ? Number(e.target.value) : null })
                  }
                />
                <CampoSelecao
                  rotulo="Responsável"
                  vazio="O responsável da entidade"
                  value={p.responsavel ? String(p.responsavel) : ''}
                  onChange={(e) => mudarPasso(i, { responsavel: e.target.value ? Number(e.target.value) : null })}
                  opcoes={(pessoas.data ?? []).map((x) => ({ valor: x.id, nome: x.nome }))}
                />
                <CampoAreaTexto
                  rotulo="Descrição (passa para a tarefa)"
                  value={p.descricao}
                  onChange={(e) => mudarPasso(i, { descricao: e.target.value })}
                />
              </div>
              <div className="acoes-formulario">
                <button type="button" className="ligacao-botao" disabled={i === 0} onClick={() => mover(i, -1)}>
                  ↑ Subir
                </button>
                <button
                  type="button"
                  className="ligacao-botao"
                  disabled={i === passos.length - 1}
                  onClick={() => mover(i, 1)}
                >
                  ↓ Descer
                </button>
                <button
                  type="button"
                  className="ligacao-botao"
                  onClick={() => setPassos((ps) => ps.filter((_, j) => j !== i))}
                >
                  Retirar
                </button>
              </div>
            </fieldset>
          ))}
          {erro('passos') && <p className="erro">{erro('passos')!.join(' ')}</p>}
          <button
            type="button"
            className="botao-secundario"
            onClick={() => setPassos((ps) => [...ps, { ...PASSO_VAZIO }])}
          >
            + Acrescentar tarefa
          </button>
        </div>
      </section>

      <div className="barra-gravar">
        <button type="button" className="botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="submit" className="botao-principal" disabled={gravar.isPending}>
          Guardar
        </button>
      </div>
    </form>
  )
}
