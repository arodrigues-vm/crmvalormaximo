import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { imoveisApi, procurarImoveis } from '../imoveis/api'
import { hora, visitasApi, type Visita } from './api'

interface Valores {
  entidade: OpcaoPesquisa | null
  imovel: OpcaoPesquisa | null
  acompanhantes: OpcaoPesquisa[]
  data: string
  hora_entrada: string
  hora_saida: string
  estado: string
  avaliacao: Record<string, string>
  mais_gostou: string
  menos_gostou: string
  compraria: string
  observacoes: string
}

const t = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const id = (v: string) => (v ? Number(v) : null)

export function VisitaNova() {
  const [params] = useSearchParams()
  const imovelId = params.get('imovel')
  const entidadeId = params.get('entidade')
  const imovel = useQuery({
    queryKey: ['imoveis', imovelId],
    queryFn: () => imoveisApi.obter(imovelId!),
    enabled: !!imovelId,
  })
  const entidade = useQuery({
    queryKey: ['entidades', entidadeId],
    queryFn: () => entidadesApi.obter(entidadeId!),
    enabled: !!entidadeId,
  })
  if ((imovelId && imovel.isLoading) || (entidadeId && entidade.isLoading))
    return <p className="a-carregar">A carregar…</p>
  const i = imovel.data
  const e = entidade.data
  return (
    <Formulario
      imovelInicial={i ? { id: i.id, titulo: i.referencia, detalhe: i.localidade } : null}
      entidadeInicial={e ? { id: e.id, titulo: e.nome_completo, detalhe: e.referencia } : null}
    />
  )
}

export function VisitaEditar() {
  const { id: pk = '' } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['visitas', pk], queryFn: () => visitasApi.obter(pk) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (!data) return <p className="aviso">Visita não encontrada ou sem acesso.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta visita.</p>
  return <Formulario visita={data} key={data.versao} />
}

function Formulario({
  visita,
  imovelInicial = null,
  entidadeInicial = null,
}: {
  visita?: Visita
  imovelInicial?: OpcaoPesquisa | null
  entidadeInicial?: OpcaoPesquisa | null
}) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const opcoes = useQuery({ queryKey: ['visitas', 'opcoes'], queryFn: visitasApi.opcoes, staleTime: 60_000 })
  const o = opcoes.data
  const inicial = useMemo<Valores>(
    () => ({
      entidade: visita
        ? { id: visita.entidade, titulo: visita.entidade_nome ?? 'Entidade a que não tem acesso' }
        : entidadeInicial,
      imovel: visita ? { id: visita.imovel, titulo: visita.imovel_descricao } : imovelInicial,
      acompanhantes: visita?.acompanhantes_detalhe.map((a) => ({ id: a.id, titulo: a.nome })) ?? [],
      data: visita?.data ?? '',
      hora_entrada: hora(visita?.hora_entrada ?? null) ?? '',
      hora_saida: hora(visita?.hora_saida ?? null) ?? '',
      estado: t(visita?.estado),
      avaliacao: Object.fromEntries(
        Object.keys(visita ?? {})
          .filter((k) => k.startsWith('av_'))
          .map((k) => [k, t(visita![k as `av_${string}`])]),
      ),
      mais_gostou: visita?.mais_gostou ?? '',
      menos_gostou: visita?.menos_gostou ?? '',
      compraria: t(visita?.compraria),
      observacoes: visita?.observacoes ?? '',
    }),
    [visita, imovelInicial, entidadeInicial],
  )
  const [v, setV] = useState(inicial)
  const [erros, setErros] = useState<Record<string, string[]>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [novoAcompanhante, setNovoAcompanhante] = useState<OpcaoPesquisa | null>(null)
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const mudar = <K extends keyof Valores>(c: K, x: Valores[K]) => setV((a) => ({ ...a, [c]: x }))
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))
  const temErro = (cs: string[]) => cs.some((c) => erros[c])
  const criterios = o?.criterios ?? []

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    const corpo = {
      entidade: v.entidade?.id ?? null,
      imovel: v.imovel?.id ?? null,
      acompanhantes: v.acompanhantes.map((a) => a.id),
      data: v.data || null,
      hora_entrada: v.hora_entrada || null,
      hora_saida: v.hora_saida || null,
      estado: id(v.estado),
      ...Object.fromEntries(criterios.map((c) => [c.campo, id(v.avaliacao[c.campo] ?? '')])),
      mais_gostou: v.mais_gostou,
      menos_gostou: v.menos_gostou,
      compraria: id(v.compraria),
      observacoes: v.observacoes,
    }
    try {
      const r = visita
        ? await visitasApi.atualizar(visita.id, { ...corpo, versao: visita.versao })
        : await visitasApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['visitas'] })
      qc.invalidateQueries({ queryKey: ['interesses'] })
      qc.setQueryData(['visitas', String(r.id)], r)
      navegar(`/visitas/${r.id}`, { replace: !visita })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else setErroGeral(err instanceof ErroApi ? err.message : 'Não foi possível gravar.')
    } finally {
      setAGravar(false)
    }
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      <CabecalhoRegisto
        modulo="Visitas"
        caminho="/visitas"
        referencia={visita?.referencia ?? 'Nova'}
        titulo={visita ? 'Editar visita' : 'Nova visita'}
      />
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <Bloco
        titulo="Visita"
        forcarAberto={temErro(['entidade', 'imovel', 'data', 'hora_entrada', 'hora_saida', 'estado'])}
      >
        <div className="grelha-campos">
          <SeletorPesquisavel
            rotulo="Imóvel"
            chave="imoveis"
            procurar={procurarImoveis}
            valor={v.imovel}
            aoMudar={(x) => mudar('imovel', x)}
            erro={erros.imovel?.join(' ')}
            placeholder="Ex.: 10 T3 Maia"
          />
          <SeletorPesquisavel
            rotulo="Cliente"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={v.entidade}
            aoMudar={(x) => mudar('entidade', x)}
            erro={erros.entidade?.join(' ')}
          />
          <CampoSelecao
            rotulo="Estado"
            vazio={visita ? undefined : 'Por omissão: Agendada'}
            value={v.estado}
            onChange={(e) => mudar('estado', e.target.value)}
            opcoes={lista(o?.estados)}
            erro={erros.estado}
          />
          <CampoTexto
            rotulo="Data da visita"
            type="date"
            required
            value={v.data}
            onChange={(e) => mudar('data', e.target.value)}
            erro={erros.data}
          />
          <CampoTexto
            rotulo="Hora de entrada"
            type="time"
            value={v.hora_entrada}
            onChange={(e) => mudar('hora_entrada', e.target.value)}
            erro={erros.hora_entrada}
          />
          <CampoTexto
            rotulo="Hora de saída"
            type="time"
            value={v.hora_saida}
            onChange={(e) => mudar('hora_saida', e.target.value)}
            erro={erros.hora_saida}
          />
        </div>
        <ul className="lista-proprietarios">
          {v.acompanhantes.map((a) => (
            <li key={a.id}>
              <span className="proprietario-nome">{a.titulo}</span>
              <button
                type="button"
                className="botao-icone"
                aria-label={`Remover ${a.titulo}`}
                onClick={() =>
                  mudar(
                    'acompanhantes',
                    v.acompanhantes.filter((x) => x.id !== a.id),
                  )
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="novo-proprietario">
          <SeletorPesquisavel
            rotulo="Acompanhantes (outras pessoas na visita)"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={novoAcompanhante}
            aoMudar={(x) => {
              if (x) {
                mudar('acompanhantes', [...v.acompanhantes, x])
                setNovoAcompanhante(null)
              }
            }}
            excluir={[...v.acompanhantes.map((a) => a.id), ...(v.entidade ? [v.entidade.id] : [])]}
          />
        </div>
      </Bloco>

      <Bloco
        titulo="Avaliação do cliente"
        abertoInicial={!!visita}
        forcarAberto={temErro(criterios.map((c) => c.campo))}
      >
        <p className="ajuda">Preencha depois da visita, com a opinião do cliente.</p>
        <div className="grelha-campos">
          {criterios.map((c) => (
            <CampoSelecao
              key={c.campo}
              rotulo={c.nome}
              vazio="—"
              value={v.avaliacao[c.campo] ?? ''}
              onChange={(e) => mudar('avaliacao', { ...v.avaliacao, [c.campo]: e.target.value })}
              opcoes={lista(o?.avaliacoes)}
              erro={erros[c.campo]}
            />
          ))}
          <CampoSelecao
            rotulo="Compraria este imóvel?"
            vazio="—"
            value={v.compraria}
            onChange={(e) => mudar('compraria', e.target.value)}
            opcoes={lista(o?.sim_nao)}
            erro={erros.compraria}
          />
        </div>
        <CampoAreaTexto
          rotulo="O que mais gostou?"
          value={v.mais_gostou}
          onChange={(e) => mudar('mais_gostou', e.target.value)}
        />
        <CampoAreaTexto
          rotulo="O que menos gostou?"
          value={v.menos_gostou}
          onChange={(e) => mudar('menos_gostou', e.target.value)}
        />
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!v.observacoes}>
        <CampoAreaTexto
          rotulo="Observações"
          value={v.observacoes}
          onChange={(e) => mudar('observacoes', e.target.value)}
        />
      </Bloco>

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(visita ? `/visitas/${visita.id}` : '/visitas')}
        >
          Cancelar
        </button>
        <button type="submit" className="botao-principal" disabled={aGravar}>
          {aGravar ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
      {guarda.dialogo}
    </form>
  )
}
