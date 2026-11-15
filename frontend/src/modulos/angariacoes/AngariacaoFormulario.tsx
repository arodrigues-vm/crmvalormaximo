import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { CampoAreaTexto, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { imoveisApi, procurarImoveis } from '../imoveis/api'
import { cmiApi, ETIQUETA_ESTADO, type Angariacao } from './api'

interface Parte {
  entidade: OpcaoPesquisa
  acessivel: boolean
  papel: string
  quota: string
}

interface Valores {
  imovel: OpcaoPesquisa | null
  numero_contrato: string
  operacao: string
  regime: string
  data_assinatura: string
  data_inicio: string
  prazo_meses: string
  modalidade_remuneracao: string
  valor_remuneracao: string
  base_contratual: string
  valor_minimo_remuneracao: string
  taxa_iva: string
  remuneracao_inclui_iva: string
  condicoes_pagamento: string
  observacoes: string
  partes: Parte[] | null // null = pré-preencher com os proprietários do imóvel
}

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const num = (v: string) => (v.trim() === '' ? null : v.trim().replace(',', '.'))
const idOuNull = (v: string) => (v ? Number(v) : null)

function deCmi(a: Angariacao): Valores {
  return {
    imovel: { id: a.imovel, titulo: a.imovel_referencia, detalhe: a.imovel_descricao },
    numero_contrato: a.numero_contrato,
    operacao: t(a.operacao),
    regime: t(a.regime),
    data_assinatura: t(a.data_assinatura),
    data_inicio: t(a.data_inicio),
    prazo_meses: t(a.prazo_meses),
    modalidade_remuneracao: a.modalidade_remuneracao,
    valor_remuneracao: a.valor_remuneracao === null ? '' : String(Number(a.valor_remuneracao)),
    base_contratual: a.base_contratual,
    valor_minimo_remuneracao: a.valor_minimo_remuneracao === null ? '' : String(Number(a.valor_minimo_remuneracao)),
    taxa_iva: a.taxa_iva === null ? '' : String(Number(a.taxa_iva)),
    remuneracao_inclui_iva: a.remuneracao_inclui_iva === null ? '' : a.remuneracao_inclui_iva ? 'sim' : 'nao',
    condicoes_pagamento: a.condicoes_pagamento,
    observacoes: a.observacoes,
    partes: a.intervenientes_detalhe.map((i) => ({
      entidade: {
        id: i.entidade,
        titulo: i.nome_completo ?? 'Entidade a que não tem acesso',
        detalhe: i.referencia ?? undefined,
      },
      acessivel: i.acessivel,
      papel: t(i.papel),
      quota: i.quota === null ? '' : String(Number(i.quota)),
    })),
  }
}

function paraApi(v: Valores, assinado: boolean) {
  const corpo: Record<string, unknown> = {
    imovel: v.imovel?.id ?? null,
    numero_contrato: v.numero_contrato,
    operacao: idOuNull(v.operacao),
    regime: idOuNull(v.regime),
    modalidade_remuneracao: v.modalidade_remuneracao,
    valor_remuneracao: num(v.valor_remuneracao),
    base_contratual: v.base_contratual,
    valor_minimo_remuneracao: num(v.valor_minimo_remuneracao),
    taxa_iva: num(v.taxa_iva),
    remuneracao_inclui_iva: v.remuneracao_inclui_iva === '' ? null : v.remuneracao_inclui_iva === 'sim',
    condicoes_pagamento: v.condicoes_pagamento,
    observacoes: v.observacoes,
  }
  if (!assinado) {
    corpo.data_assinatura = v.data_assinatura || null
    corpo.data_inicio = v.data_inicio || null
    corpo.prazo_meses = num(v.prazo_meses)
  }
  if (v.partes !== null)
    corpo.intervenientes = v.partes.map((p) => ({
      entidade: p.entidade.id,
      papel: idOuNull(p.papel),
      quota: num(p.quota),
    }))
  return corpo
}

const BLOCOS: Record<string, string[]> = {
  contrato: ['imovel', 'numero_contrato', 'operacao', 'regime', 'data_assinatura', 'data_inicio', 'prazo_meses'],
  partes: ['intervenientes'],
  remuneracao: [
    'modalidade_remuneracao',
    'valor_remuneracao',
    'base_contratual',
    'valor_minimo_remuneracao',
    'taxa_iva',
    'remuneracao_inclui_iva',
    'condicoes_pagamento',
  ],
  observacoes: ['observacoes'],
}

export function AngariacaoNova() {
  const [params] = useSearchParams()
  const imovelId = params.get('imovel')
  const { data: imovel, isLoading } = useQuery({
    queryKey: ['imoveis', imovelId],
    queryFn: () => imoveisApi.obter(imovelId!),
    enabled: !!imovelId,
  })
  if (imovelId && isLoading) return <p className="a-carregar">A carregar…</p>
  const inicial = imovel
    ? {
        id: imovel.id,
        titulo: imovel.referencia,
        detalhe: [imovel.nomes.tipo, imovel.nomes.tipologia, imovel.localidade].filter(Boolean).join(' · '),
      }
    : null
  return <Formulario imovelInicial={inicial} />
}

export function AngariacaoEditar() {
  const { id = '' } = useParams()
  const { data, error, isLoading } = useQuery({ queryKey: ['angariacoes', id], queryFn: () => cmiApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Angariação não encontrada ou sem acesso.</p>
  if (!data) return <p className="erro">Não foi possível carregar a angariação.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta angariação.</p>
  return <Formulario cmi={data} key={data.versao} />
}

function Formulario({ cmi, imovelInicial = null }: { cmi?: Angariacao; imovelInicial?: OpcaoPesquisa | null }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const inicial = useMemo<Valores>(
    () =>
      cmi
        ? deCmi(cmi)
        : {
            imovel: imovelInicial,
            numero_contrato: '',
            operacao: '',
            regime: '',
            data_assinatura: '',
            data_inicio: '',
            prazo_meses: '',
            modalidade_remuneracao: '',
            valor_remuneracao: '',
            base_contratual: '',
            valor_minimo_remuneracao: '',
            taxa_iva: '',
            remuneracao_inclui_iva: '',
            condicoes_pagamento: '',
            observacoes: '',
            partes: null,
          },
    [cmi, imovelInicial],
  )
  const [v, setV] = useState<Valores>(inicial)
  const [erros, setErros] = useState<Record<string, unknown>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [novaParte, setNovaParte] = useState<OpcaoPesquisa | null>(null)
  const opcoes = useQuery({ queryKey: ['angariacoes', 'opcoes'], queryFn: cmiApi.opcoes, staleTime: 60_000 })
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const o = opcoes.data
  const assinado = !!cmi?.assinado

  const mudar = <K extends keyof Valores>(c: K, valor: Valores[K]) => setV((a) => ({ ...a, [c]: valor }))
  const erro = (c: string) => erros[c] as string[] | undefined
  const temErros = (b: string) => BLOCOS[b].some((c) => erros[c])
  const lista = (itens?: { id: number; nome: string }[]) => (itens ?? []).map((x) => ({ valor: x.id, nome: x.nome }))

  // Modalidades possíveis dependem da categoria da operação (venda / arrendamento).
  const categoria = o?.operacoes.find((x) => String(x.id) === v.operacao)?.categoria
  const modalidades = (o?.modalidades ?? []).filter(
    (m) => !categoria || (o?.modalidades_por_operacao[categoria] ?? []).includes(m.valor),
  )
  const rotuloValor =
    v.modalidade_remuneracao === 'valor_fixo'
      ? 'Valor (€)'
      : v.modalidade_remuneracao === 'numero_rendas'
        ? 'Número de rendas'
        : 'Percentagem (%)'

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    try {
      const corpo = paraApi(v, assinado)
      const r = cmi ? await cmiApi.atualizar(cmi.id, { ...corpo, versao: cmi.versao }) : await cmiApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['angariacoes'] })
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      qc.setQueryData(['angariacoes', String(r.id)], r)
      navegar(`/angariacoes/${r.id}`, { replace: !cmi })
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
      {cmi ? (
        <CabecalhoRegisto
          modulo="Angariações"
          caminho="/angariacoes"
          referencia={cmi.referencia}
          titulo={`CMI · ${cmi.imovel_referencia}`}
          etiqueta={{ texto: cmi.estado_nome, tipo: ETIQUETA_ESTADO[cmi.estado] }}
        />
      ) : (
        <CabecalhoRegisto
          modulo="Angariações"
          caminho="/angariacoes"
          referencia="Nova"
          titulo="Nova angariação (CMI)"
        />
      )}
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <Bloco titulo="Contrato" forcarAberto={temErros('contrato')}>
        <div className="grelha-campos">
          {cmi?.assinado ? (
            <div className="campo">
              <span className="rotulo-falso">Imóvel</span>
              <strong>
                {cmi.imovel_referencia} · {cmi.imovel_descricao}
              </strong>
            </div>
          ) : (
            <SeletorPesquisavel
              rotulo="Imóvel"
              chave="imoveis"
              procurar={procurarImoveis}
              valor={v.imovel}
              aoMudar={(i) => mudar('imovel', i)}
              erro={erro('imovel')?.join(' ')}
              placeholder="Referência, morada ou proprietário…"
            />
          )}
          <CampoTexto
            rotulo="N.º do contrato"
            value={v.numero_contrato}
            onChange={(e) => mudar('numero_contrato', e.target.value)}
            erro={erro('numero_contrato')}
          />
          <CampoSelecao
            rotulo="Tipo (operação)"
            vazio="Igual à do imóvel"
            value={v.operacao}
            onChange={(e) => mudar('operacao', e.target.value)}
            opcoes={lista(o?.operacoes)}
            erro={erro('operacao')}
          />
          <CampoSelecao
            rotulo="Regime"
            vazio="—"
            value={v.regime}
            onChange={(e) => mudar('regime', e.target.value)}
            opcoes={lista(o?.regimes)}
            erro={erro('regime')}
          />
          {assinado ? (
            <p className="ajuda largo">
              O contrato está assinado: datas e prazo só podem ser alterados por <strong>Correção excecional</strong>{' '}
              (na ficha), com motivo e evidência.
            </p>
          ) : (
            <>
              <CampoTexto
                rotulo="Data de assinatura"
                type="date"
                value={v.data_assinatura}
                onChange={(e) => mudar('data_assinatura', e.target.value)}
                erro={erro('data_assinatura')}
                ajuda="Deixe vazio enquanto o contrato não estiver assinado."
              />
              <CampoTexto
                rotulo="Data de início"
                type="date"
                value={v.data_inicio}
                onChange={(e) => mudar('data_inicio', e.target.value)}
                erro={erro('data_inicio')}
              />
              <CampoTexto
                rotulo="Prazo (meses)"
                inputMode="numeric"
                value={v.prazo_meses}
                onChange={(e) => mudar('prazo_meses', e.target.value)}
                erro={erro('prazo_meses')}
                ajuda="A data de fim é calculada (início + prazo − 1 dia)."
              />
            </>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Partes" forcarAberto={temErros('partes')}>
        {v.partes === null ? (
          <p className="ajuda">
            As partes serão preenchidas automaticamente com os proprietários atuais do imóvel.{' '}
            <button type="button" className="botao-secundario" onClick={() => mudar('partes', [])}>
              Indicar manualmente
            </button>
          </p>
        ) : (
          <>
            <ul className="lista-proprietarios">
              {v.partes.map((p, i) => (
                <li key={p.entidade.id}>
                  <span className="proprietario-nome">
                    {p.acessivel ? (
                      <strong>{p.entidade.titulo}</strong>
                    ) : (
                      <span className="vazio">{p.entidade.titulo}</span>
                    )}
                  </span>
                  <select
                    aria-label="Papel"
                    value={p.papel}
                    disabled={!p.acessivel}
                    onChange={(e) =>
                      mudar(
                        'partes',
                        v.partes!.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)),
                      )
                    }
                  >
                    <option value="">Papel…</option>
                    {o?.papeis.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                  <label className="quota">
                    Quota (%)
                    <input
                      inputMode="decimal"
                      value={p.quota}
                      disabled={!p.acessivel}
                      onChange={(e) =>
                        mudar(
                          'partes',
                          v.partes!.map((x, j) => (j === i ? { ...x, quota: e.target.value } : x)),
                        )
                      }
                    />
                  </label>
                  {p.acessivel && (
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Remover ${p.entidade.titulo}`}
                      onClick={() =>
                        mudar(
                          'partes',
                          v.partes!.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {erro('intervenientes') && <p className="campo-erro">{erro('intervenientes')!.join(' ')}</p>}
            <div className="novo-proprietario">
              <SeletorPesquisavel
                rotulo="Acrescentar parte"
                chave="entidades"
                procurar={entidadesApi.procurar}
                valor={novaParte}
                aoMudar={(e) => {
                  if (e) {
                    mudar('partes', [...v.partes!, { entidade: e, acessivel: true, papel: '', quota: '' }])
                    setNovaParte(null)
                  }
                }}
                excluir={v.partes.map((p) => p.entidade.id)}
              />
            </div>
          </>
        )}
      </Bloco>

      <Bloco titulo="Remuneração e pagamento" forcarAberto={temErros('remuneracao')}>
        <div className="grelha-campos">
          <CampoSelecao
            rotulo="Modalidade"
            vazio="—"
            value={v.modalidade_remuneracao}
            onChange={(e) => mudar('modalidade_remuneracao', e.target.value)}
            opcoes={modalidades}
            erro={erro('modalidade_remuneracao')}
          />
          <CampoTexto
            rotulo={rotuloValor}
            inputMode="decimal"
            value={v.valor_remuneracao}
            onChange={(e) => mudar('valor_remuneracao', e.target.value)}
            erro={erro('valor_remuneracao')}
            ajuda="Vazio = ainda não indicado; 0 = sem remuneração."
          />
          {v.modalidade_remuneracao === 'percentagem_base' && (
            <CampoTexto
              rotulo="Base contratual"
              largo
              value={v.base_contratual}
              onChange={(e) => mudar('base_contratual', e.target.value)}
              erro={erro('base_contratual')}
              ajuda="Sobre que valor incide a percentagem (ex.: total das rendas do 1.º ano)."
            />
          )}
          <CampoTexto
            rotulo="Remuneração mínima (€)"
            inputMode="decimal"
            value={v.valor_minimo_remuneracao}
            onChange={(e) => mudar('valor_minimo_remuneracao', e.target.value)}
            erro={erro('valor_minimo_remuneracao')}
          />
          <CampoTexto
            rotulo="Taxa de IVA (%)"
            inputMode="decimal"
            value={v.taxa_iva}
            onChange={(e) => mudar('taxa_iva', e.target.value)}
            erro={erro('taxa_iva')}
          />
          <CampoSelecao
            rotulo="Valores indicados"
            vazio="Não indicado"
            value={v.remuneracao_inclui_iva}
            onChange={(e) => mudar('remuneracao_inclui_iva', e.target.value)}
            opcoes={[
              { valor: 'nao', nome: 'Acresce IVA' },
              { valor: 'sim', nome: 'Com IVA incluído' },
            ]}
          />
          <CampoAreaTexto
            rotulo="Condições e momentos de pagamento"
            value={v.condicoes_pagamento}
            onChange={(e) => mudar('condicoes_pagamento', e.target.value)}
            erro={erro('condicoes_pagamento')}
            placeholder="Ex.: 50% na assinatura do CPCV e 50% na escritura."
          />
        </div>
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!v.observacoes} forcarAberto={temErros('observacoes')}>
        <CampoAreaTexto
          rotulo="Observações"
          value={v.observacoes}
          onChange={(e) => mudar('observacoes', e.target.value)}
        />
      </Bloco>

      <div className="barra-gravar">
        {!cmi && v.imovel && (
          <Link to={`/imoveis/${v.imovel.id}`} className="ligacao-secundaria">
            Ver imóvel
          </Link>
        )}
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(cmi ? `/angariacoes/${cmi.id}` : '/angariacoes')}
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
