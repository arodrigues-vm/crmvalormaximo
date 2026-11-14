import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { CampoAreaTexto, CampoMultiplo, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { CabecalhoRegisto } from '../../componentes/Ficha'
import { SeletorLocalizacao } from '../../componentes/SeletorLocalizacao'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { entidadesApi } from '../entidades/api'
import { imoveisApi, STATUS_ETIQUETA, tituloImovel, type Imovel } from './api'

interface ProprietarioEditavel {
  entidade: OpcaoPesquisa
  /** Entidades sem acesso mantêm-se, mas não podem ser alteradas. */
  acessivel: boolean
  quota: string
}

interface Valores {
  tipo: string
  tipologia: string
  operacao: string
  estado_comercializacao: string
  status: string
  condicao_fisica: string
  preco: string
  rua: string
  numero_policia: string
  complemento: string
  codigo_postal: string
  localidade: string
  freguesia: number | null
  zona_comercial: string
  localizacao_descritiva: string
  area_bruta_privativa: string
  area_bruta_dependente: string
  area_util: string
  area_terreno: string
  quartos: string
  casas_banho: string
  ano_construcao: string
  piso: string
  elevador: string
  lugares_estacionamento: string
  certificado_energetico: string
  zonas_exteriores: number[]
  descricao: string
  observacoes: string
  proprietarios: ProprietarioEditavel[]
}

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))

const VAZIO: Valores = {
  tipo: '',
  tipologia: '',
  operacao: 'venda',
  estado_comercializacao: '',
  status: 'ativo',
  condicao_fisica: '',
  preco: '',
  rua: '',
  numero_policia: '',
  complemento: '',
  codigo_postal: '',
  localidade: '',
  freguesia: null,
  zona_comercial: '',
  localizacao_descritiva: '',
  area_bruta_privativa: '',
  area_bruta_dependente: '',
  area_util: '',
  area_terreno: '',
  quartos: '',
  casas_banho: '',
  ano_construcao: '',
  piso: '',
  elevador: '',
  lugares_estacionamento: '',
  certificado_energetico: '',
  zonas_exteriores: [],
  descricao: '',
  observacoes: '',
  proprietarios: [],
}

function deImovel(i: Imovel): Valores {
  return {
    tipo: t(i.tipo),
    tipologia: t(i.tipologia),
    operacao: i.operacao,
    estado_comercializacao: t(i.estado_comercializacao),
    status: i.status,
    condicao_fisica: t(i.condicao_fisica),
    preco: t(i.preco),
    rua: i.rua,
    numero_policia: i.numero_policia,
    complemento: i.complemento,
    codigo_postal: i.codigo_postal,
    localidade: i.localidade,
    freguesia: i.freguesia,
    zona_comercial: t(i.zona_comercial),
    localizacao_descritiva: i.localizacao_descritiva,
    area_bruta_privativa: t(i.area_bruta_privativa),
    area_bruta_dependente: t(i.area_bruta_dependente),
    area_util: t(i.area_util),
    area_terreno: t(i.area_terreno),
    quartos: t(i.quartos),
    casas_banho: t(i.casas_banho),
    ano_construcao: t(i.ano_construcao),
    piso: i.piso,
    elevador: i.elevador === null ? '' : i.elevador ? 'sim' : 'nao',
    lugares_estacionamento: t(i.lugares_estacionamento),
    certificado_energetico: t(i.certificado_energetico),
    zonas_exteriores: i.zonas_exteriores,
    descricao: i.descricao,
    observacoes: i.observacoes,
    proprietarios: i.proprietarios_detalhe.map((p) => ({
      entidade: {
        id: p.entidade,
        titulo: p.nome_completo ?? 'Entidade a que não tem acesso',
        detalhe: p.referencia ?? undefined,
      },
      acessivel: p.acessivel,
      quota: t(p.quota === null ? null : Number(p.quota)),
    })),
  }
}

const id = (v: string) => (v ? Number(v) : null)
const num = (v: string) => (v.trim() === '' ? null : v.trim().replace(',', '.'))

function paraApi(v: Valores) {
  return {
    tipo: id(v.tipo),
    tipologia: id(v.tipologia),
    operacao: v.operacao,
    estado_comercializacao: id(v.estado_comercializacao),
    status: v.status,
    condicao_fisica: id(v.condicao_fisica),
    preco: num(v.preco),
    rua: v.rua,
    numero_policia: v.numero_policia,
    complemento: v.complemento,
    codigo_postal: v.codigo_postal,
    localidade: v.localidade,
    freguesia: v.freguesia,
    zona_comercial: id(v.zona_comercial),
    localizacao_descritiva: v.localizacao_descritiva,
    area_bruta_privativa: num(v.area_bruta_privativa),
    area_bruta_dependente: num(v.area_bruta_dependente),
    area_util: num(v.area_util),
    area_terreno: num(v.area_terreno),
    quartos: num(v.quartos),
    casas_banho: num(v.casas_banho),
    ano_construcao: num(v.ano_construcao),
    piso: v.piso,
    elevador: v.elevador === '' ? null : v.elevador === 'sim',
    lugares_estacionamento: num(v.lugares_estacionamento),
    certificado_energetico: id(v.certificado_energetico),
    zonas_exteriores: v.zonas_exteriores,
    descricao: v.descricao,
    observacoes: v.observacoes,
    proprietarios: v.proprietarios.map((p) => ({ entidade: p.entidade.id, quota: num(p.quota) })),
  }
}

const BLOCOS: Record<string, string[]> = {
  comercializacao: ['operacao', 'preco', 'estado_comercializacao', 'status', 'responsavel'],
  proprietarios: ['proprietarios'],
  classificacao: [
    'tipo',
    'tipologia',
    'condicao_fisica',
    'quartos',
    'casas_banho',
    'ano_construcao',
    'piso',
    'elevador',
    'lugares_estacionamento',
    'certificado_energetico',
    'zonas_exteriores',
  ],
  areas: ['area_bruta_privativa', 'area_bruta_dependente', 'area_util', 'area_terreno'],
  localizacao: [
    'rua',
    'numero_policia',
    'complemento',
    'codigo_postal',
    'localidade',
    'freguesia',
    'zona_comercial',
    'localizacao_descritiva',
  ],
  textos: ['descricao', 'observacoes'],
}

export function ImovelNovo() {
  return <Formulario />
}

export function ImovelEditar() {
  const { id: pk = '' } = useParams()
  const { data, error, isLoading } = useQuery({ queryKey: ['imoveis', pk], queryFn: () => imoveisApi.obter(pk) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Imóvel não encontrado ou sem acesso.</p>
  if (!data) return <p className="erro">Não foi possível carregar o imóvel.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar este imóvel.</p>
  return <Formulario imovel={data} key={data.versao} />
}

function Formulario({ imovel }: { imovel?: Imovel }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const inicial = useMemo(() => (imovel ? deImovel(imovel) : VAZIO), [imovel])
  const [v, setV] = useState<Valores>(inicial)
  const [erros, setErros] = useState<Record<string, unknown>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [novoProprietario, setNovoProprietario] = useState<OpcaoPesquisa | null>(null)
  const opcoes = useQuery({ queryKey: ['imoveis', 'opcoes'], queryFn: imoveisApi.opcoes, staleTime: 60_000 })
  const guarda = useGuardaSaida(JSON.stringify(v) !== JSON.stringify(inicial))
  const o = opcoes.data

  const mudar = <K extends keyof Valores>(campo: K, valor: Valores[K]) => setV((a) => ({ ...a, [campo]: valor }))
  const erro = (c: string) => erros[c] as string[] | undefined
  const temErros = (b: string) => BLOCOS[b].some((c) => erros[c])
  const lista = (itens?: { id: number; nome: string }[]) => (itens ?? []).map((x) => ({ valor: x.id, nome: x.nome }))
  // Valores desativados que o imóvel já tem continuam a aparecer na lista.
  const comAtual = (itens: { valor: number | string; nome: string }[], atual: string, nome: string | null) =>
    atual && nome && !itens.some((x) => String(x.valor) === atual) ? [...itens, { valor: atual, nome }] : itens

  const somaQuotas = v.proprietarios.reduce((s, p) => s + (p.quota ? Number(p.quota.replace(',', '.')) : 0), 0)

  async function submeter(e: FormEvent) {
    e.preventDefault()
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    try {
      const corpo = paraApi(v)
      const r = imovel
        ? await imoveisApi.atualizar(imovel.id, { ...corpo, versao: imovel.versao })
        : await imoveisApi.criar(corpo)
      guarda.libertar()
      qc.invalidateQueries({ queryKey: ['imoveis'] })
      qc.invalidateQueries({ queryKey: ['entidades'] })
      qc.setQueryData(['imoveis', String(r.id)], r)
      navegar(`/imoveis/${r.id}`, { replace: !imovel })
    } catch (err) {
      if (err instanceof ErroApi && err.estado === 400) {
        setErros(err.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else if (err instanceof ErroApi) {
        setErroGeral(err.message)
      } else {
        setErroGeral('Não foi possível gravar. Verifique a ligação e tente de novo.')
      }
    } finally {
      setAGravar(false)
    }
  }

  const n = imovel?.nomes
  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      {imovel ? (
        <CabecalhoRegisto
          modulo="Imóveis"
          caminho="/imoveis"
          referencia={imovel.referencia}
          titulo={tituloImovel({ tipo: n?.tipo, tipologia: n?.tipologia, localidade: imovel.localidade })}
          etiqueta={{ texto: n!.status, tipo: STATUS_ETIQUETA[imovel.status] }}
        />
      ) : (
        <CabecalhoRegisto modulo="Imóveis" caminho="/imoveis" referencia="Novo" titulo="Novo imóvel" />
      )}
      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <Bloco titulo="Comercialização" forcarAberto={temErros('comercializacao')}>
        <div className="grelha-campos">
          <CampoSelecao
            rotulo="Operação"
            required
            value={v.operacao}
            onChange={(e) => mudar('operacao', e.target.value)}
            opcoes={o?.operacoes ?? []}
            erro={erro('operacao')}
          />
          <CampoTexto
            rotulo="Preço (€)"
            inputMode="decimal"
            value={v.preco}
            onChange={(e) => mudar('preco', e.target.value)}
            erro={erro('preco')}
            ajuda="Deixe vazio se ainda não for conhecido."
          />
          <CampoSelecao
            rotulo="Estado de comercialização"
            vazio="—"
            value={v.estado_comercializacao}
            onChange={(e) => mudar('estado_comercializacao', e.target.value)}
            opcoes={comAtual(
              lista(o?.estados_comercializacao),
              v.estado_comercializacao,
              n?.estado_comercializacao ?? null,
            )}
            erro={erro('estado_comercializacao')}
          />
          <CampoSelecao
            rotulo="Status"
            value={v.status}
            onChange={(e) => mudar('status', e.target.value)}
            opcoes={o?.status ?? []}
            erro={erro('status')}
          />
        </div>
      </Bloco>

      <Bloco titulo="Proprietários" forcarAberto={temErros('proprietarios')}>
        {v.proprietarios.length === 0 && <p className="ajuda">Sem proprietários.</p>}
        <ul className="lista-proprietarios">
          {v.proprietarios.map((p, i) => (
            <li key={p.entidade.id}>
              <span className="proprietario-nome">
                {p.acessivel ? (
                  <strong>{p.entidade.titulo}</strong>
                ) : (
                  <span className="vazio">{p.entidade.titulo}</span>
                )}
                {p.entidade.detalhe && <small className="ajuda"> {p.entidade.detalhe}</small>}
              </span>
              <label className="quota">
                Quota (%)
                <input
                  inputMode="decimal"
                  value={p.quota}
                  disabled={!p.acessivel}
                  onChange={(e) =>
                    mudar(
                      'proprietarios',
                      v.proprietarios.map((x, j) => (j === i ? { ...x, quota: e.target.value } : x)),
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
                      'proprietarios',
                      v.proprietarios.filter((_, j) => j !== i),
                    )
                  }
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {v.proprietarios.length > 0 && (
          <p className={somaQuotas > 100 ? 'campo-erro' : 'ajuda'}>
            Soma das quotas indicadas: {somaQuotas.toLocaleString('pt-PT')} %{somaQuotas > 100 && ' (máximo 100 %)'}
          </p>
        )}
        {erro('proprietarios') && (
          <p className="campo-erro" role="alert">
            {erro('proprietarios')!.join(' ')}
          </p>
        )}
        <div className="novo-proprietario">
          <SeletorPesquisavel
            rotulo="Acrescentar proprietário"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={novoProprietario}
            aoMudar={(e) => {
              if (e) {
                mudar('proprietarios', [...v.proprietarios, { entidade: e, acessivel: true, quota: '' }])
                setNovoProprietario(null)
              }
            }}
            excluir={v.proprietarios.map((p) => p.entidade.id)}
            placeholder="Nome, NIF ou referência da entidade…"
          />
          <Link to="/entidades/nova" target="_blank" className="ligacao-secundaria">
            Criar nova entidade
          </Link>
        </div>
      </Bloco>

      <Bloco titulo="Classificação e características" forcarAberto={temErros('classificacao')}>
        <div className="grelha-campos">
          <CampoSelecao
            rotulo="Tipo de imóvel"
            vazio="—"
            value={v.tipo}
            onChange={(e) => mudar('tipo', e.target.value)}
            opcoes={comAtual(lista(o?.tipos), v.tipo, n?.tipo ?? null)}
            erro={erro('tipo')}
          />
          <CampoSelecao
            rotulo="Tipologia"
            vazio="—"
            value={v.tipologia}
            onChange={(e) => mudar('tipologia', e.target.value)}
            opcoes={comAtual(lista(o?.tipologias), v.tipologia, n?.tipologia ?? null)}
            erro={erro('tipologia')}
          />
          <CampoSelecao
            rotulo="Condição física"
            vazio="—"
            value={v.condicao_fisica}
            onChange={(e) => mudar('condicao_fisica', e.target.value)}
            opcoes={comAtual(lista(o?.condicoes_fisicas), v.condicao_fisica, n?.condicao_fisica ?? null)}
            erro={erro('condicao_fisica')}
          />
          <CampoTexto
            rotulo="Quartos"
            inputMode="numeric"
            value={v.quartos}
            onChange={(e) => mudar('quartos', e.target.value)}
            erro={erro('quartos')}
          />
          <CampoTexto
            rotulo="Casas de banho"
            inputMode="numeric"
            value={v.casas_banho}
            onChange={(e) => mudar('casas_banho', e.target.value)}
            erro={erro('casas_banho')}
          />
          <CampoTexto
            rotulo="Ano de construção"
            inputMode="numeric"
            value={v.ano_construcao}
            onChange={(e) => mudar('ano_construcao', e.target.value)}
            erro={erro('ano_construcao')}
          />
          <CampoTexto
            rotulo="Piso"
            value={v.piso}
            onChange={(e) => mudar('piso', e.target.value)}
            erro={erro('piso')}
          />
          <CampoSelecao
            rotulo="Elevador"
            vazio="Desconhecido"
            value={v.elevador}
            onChange={(e) => mudar('elevador', e.target.value)}
            opcoes={[
              { valor: 'sim', nome: 'Sim' },
              { valor: 'nao', nome: 'Não' },
            ]}
          />
          <CampoTexto
            rotulo="Lugares de estacionamento"
            inputMode="numeric"
            value={v.lugares_estacionamento}
            onChange={(e) => mudar('lugares_estacionamento', e.target.value)}
            erro={erro('lugares_estacionamento')}
          />
          <CampoSelecao
            rotulo="Certificado energético"
            vazio="—"
            value={v.certificado_energetico}
            onChange={(e) => mudar('certificado_energetico', e.target.value)}
            opcoes={comAtual(
              lista(o?.certificados_energeticos),
              v.certificado_energetico,
              n?.certificado_energetico ?? null,
            )}
            erro={erro('certificado_energetico')}
          />
          <CampoMultiplo
            rotulo="Zonas exteriores"
            opcoes={o?.zonas_exteriores ?? []}
            valores={v.zonas_exteriores}
            aoMudar={(z) => mudar('zonas_exteriores', z)}
            erro={erro('zonas_exteriores')}
          />
        </div>
      </Bloco>

      <Bloco titulo="Áreas (m²)" forcarAberto={temErros('areas')}>
        <div className="grelha-campos">
          {(
            [
              ['area_bruta_privativa', 'Área bruta privativa'],
              ['area_bruta_dependente', 'Área bruta dependente'],
              ['area_util', 'Área útil'],
              ['area_terreno', 'Área do terreno'],
            ] as const
          ).map(([c, r]) => (
            <CampoTexto
              key={c}
              rotulo={r}
              inputMode="decimal"
              value={v[c]}
              onChange={(e) => mudar(c, e.target.value)}
              erro={erro(c)}
            />
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Localização" forcarAberto={temErros('localizacao')}>
        <div className="grelha-campos">
          <CampoTexto
            rotulo="Rua"
            largo
            value={v.rua}
            onChange={(e) => mudar('rua', e.target.value)}
            erro={erro('rua')}
          />
          <CampoTexto
            rotulo="N.º de polícia"
            value={v.numero_policia}
            onChange={(e) => mudar('numero_policia', e.target.value)}
            erro={erro('numero_policia')}
          />
          <CampoTexto
            rotulo="Complemento"
            value={v.complemento}
            onChange={(e) => mudar('complemento', e.target.value)}
            erro={erro('complemento')}
            ajuda="Andar, fração, lote…"
          />
          <CampoTexto
            rotulo="Código postal"
            placeholder="0000-000"
            value={v.codigo_postal}
            onChange={(e) => mudar('codigo_postal', e.target.value)}
            erro={erro('codigo_postal')}
          />
          <CampoTexto
            rotulo="Localidade"
            value={v.localidade}
            onChange={(e) => mudar('localidade', e.target.value)}
            erro={erro('localidade')}
          />
          <SeletorLocalizacao
            freguesia={v.freguesia}
            atual={imovel?.freguesia === v.freguesia ? imovel?.localizacao : null}
            aoMudar={(f) => mudar('freguesia', f)}
          />
          <CampoSelecao
            rotulo="Zona comercial"
            vazio="—"
            value={v.zona_comercial}
            onChange={(e) => mudar('zona_comercial', e.target.value)}
            opcoes={comAtual(lista(o?.zonas_comerciais), v.zona_comercial, n?.zona_comercial ?? null)}
            erro={erro('zona_comercial')}
            ajuda={o && o.zonas_comerciais.length === 0 ? 'Sem zonas configuradas (Configurações).' : undefined}
          />
          <CampoTexto
            rotulo="Localização descritiva"
            value={v.localizacao_descritiva}
            onChange={(e) => mudar('localizacao_descritiva', e.target.value)}
            erro={erro('localizacao_descritiva')}
            ajuda="Ex.: junto ao parque da cidade."
          />
        </div>
      </Bloco>

      <Bloco
        titulo="Descrição e observações"
        abertoInicial={!!(v.descricao || v.observacoes)}
        forcarAberto={temErros('textos')}
      >
        <div className="grelha-campos">
          <CampoAreaTexto
            rotulo="Descrição"
            value={v.descricao}
            onChange={(e) => mudar('descricao', e.target.value)}
            erro={erro('descricao')}
          />
          <CampoAreaTexto
            rotulo="Observações (internas)"
            value={v.observacoes}
            onChange={(e) => mudar('observacoes', e.target.value)}
            erro={erro('observacoes')}
          />
        </div>
      </Bloco>

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(imovel ? `/imoveis/${imovel.id}` : '/imoveis')}
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
