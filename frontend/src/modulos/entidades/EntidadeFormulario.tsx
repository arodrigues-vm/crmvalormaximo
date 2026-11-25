import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { BlocosConfiguraveis } from '../../componentes/BlocosConfiguraveis'
import { CampoResponsavel } from '../../componentes/CampoResponsavel'
import { CampoTelefones, type TelefoneEditavel } from '../../componentes/CampoTelefones'
import { CampoAreaTexto, CampoCaixa, CampoMultiplo, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { SeletorLocalizacao } from '../../componentes/SeletorLocalizacao'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { comoRegistoCp, usePersonalizados } from '../../componentes/personalizados'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { procurarImoveis } from '../imoveis/api'
import { entidadesApi, MOTIVOS, type Candidato, type Entidade, type RegistoLigado } from './api'
import { CabecalhoFicha } from './EntidadeConsulta'
import { ECRA_ENTIDADE, SO_SINGULAR } from './disposicao'

interface Valores {
  tipo_pessoa: 'singular' | 'coletiva'
  nome: string
  apelido: string
  pais_fiscal: string
  nif: string
  data_nascimento: string
  email: string
  telefones: TelefoneEditavel[]
  rua: string
  numero_policia: string
  complemento: string
  codigo_postal: string
  localidade: string
  freguesia: number | null
  papeis: number[]
  origem: string
  status: string
  responsavel: string
  quem_recomendou: OpcaoPesquisa | null
  imovel_contacto: OpcaoPesquisa | null
  visitou_imovel_contacto: '' | 'sim' | 'nao'
  motivo_nao_visitou: string
  estado_civil: string
  regime_casamento: string
  nacionalidade: string
  documento_identificacao: string
  naturalidade_freguesia: string
  naturalidade_concelho: string
  empresa: string
  cargo: string
  observacoes_pessoais: string
  zona_comercial: string
  observacoes: string
  consentimento_marketing: string
  consentimento_marketing_em: string
  oposicao_marketing: boolean
}

const VAZIO: Valores = {
  tipo_pessoa: 'singular',
  nome: '',
  apelido: '',
  pais_fiscal: 'PT',
  nif: '',
  data_nascimento: '',
  email: '',
  telefones: [{ regiao: 'PT', numero: '', tipo: 'movel', principal: true }],
  rua: '',
  numero_policia: '',
  complemento: '',
  codigo_postal: '',
  localidade: '',
  freguesia: null,
  papeis: [],
  origem: '',
  status: '',
  responsavel: '',
  quem_recomendou: null,
  imovel_contacto: null,
  visitou_imovel_contacto: '',
  motivo_nao_visitou: '',
  estado_civil: '',
  regime_casamento: '',
  nacionalidade: '',
  documento_identificacao: '',
  naturalidade_freguesia: '',
  naturalidade_concelho: '',
  empresa: '',
  cargo: '',
  observacoes_pessoais: '',
  zona_comercial: '',
  observacoes: '',
  consentimento_marketing: 'desconhecido',
  consentimento_marketing_em: '',
  oposicao_marketing: false,
}

const t = (x: number | null) => (x ? String(x) : '')
const n = (x: string) => (x ? Number(x) : null)
const ligado = (d: RegistoLigado | null): OpcaoPesquisa | null =>
  d ? { id: d.id, titulo: d.referencia ? `${d.referencia} · ${d.nome}` : d.nome } : null

function deEntidade(e: Entidade): Valores {
  return {
    tipo_pessoa: e.tipo_pessoa,
    nome: e.nome,
    apelido: e.apelido,
    pais_fiscal: e.pais_fiscal,
    nif: e.nif,
    data_nascimento: e.data_nascimento ?? '',
    email: e.email,
    telefones: e.telefones.map((t) => ({
      id: t.id,
      regiao: t.regiao,
      numero: t.numero,
      tipo: t.tipo,
      principal: t.principal,
    })),
    rua: e.rua,
    numero_policia: e.numero_policia,
    complemento: e.complemento,
    codigo_postal: e.codigo_postal,
    localidade: e.localidade,
    freguesia: e.freguesia,
    papeis: e.papeis,
    origem: e.origem ? String(e.origem) : '',
    status: e.status ? String(e.status) : '',
    responsavel: String(e.responsavel),
    quem_recomendou: ligado(e.quem_recomendou_dados),
    imovel_contacto: ligado(e.imovel_contacto_dados),
    visitou_imovel_contacto: e.visitou_imovel_contacto === null ? '' : e.visitou_imovel_contacto ? 'sim' : 'nao',
    motivo_nao_visitou: e.motivo_nao_visitou,
    estado_civil: t(e.estado_civil),
    regime_casamento: t(e.regime_casamento),
    nacionalidade: e.nacionalidade,
    documento_identificacao: e.documento_identificacao,
    naturalidade_freguesia: e.naturalidade_freguesia,
    naturalidade_concelho: e.naturalidade_concelho,
    empresa: e.empresa,
    cargo: e.cargo,
    observacoes_pessoais: e.observacoes_pessoais,
    zona_comercial: t(e.zona_comercial),
    observacoes: e.observacoes,
    consentimento_marketing: e.consentimento_marketing,
    consentimento_marketing_em: e.consentimento_marketing_em ?? '',
    oposicao_marketing: e.oposicao_marketing,
  }
}

function paraApi(v: Valores) {
  return {
    ...v,
    apelido: v.tipo_pessoa === 'coletiva' ? '' : v.apelido,
    data_nascimento: v.tipo_pessoa === 'coletiva' || !v.data_nascimento ? null : v.data_nascimento,
    consentimento_marketing_em: v.consentimento_marketing_em || null,
    origem: n(v.origem),
    status: n(v.status),
    responsavel: v.responsavel ? Number(v.responsavel) : undefined,
    estado_civil: n(v.estado_civil),
    regime_casamento: n(v.regime_casamento),
    zona_comercial: n(v.zona_comercial),
    quem_recomendou: v.quem_recomendou?.id ?? null,
    imovel_contacto: v.imovel_contacto?.id ?? null,
    visitou_imovel_contacto: v.visitou_imovel_contacto === '' ? null : v.visitou_imovel_contacto === 'sim',
    motivo_nao_visitou: v.visitou_imovel_contacto === 'sim' ? '' : v.motivo_nao_visitou,
    // Linhas de telefone deixadas em branco são ignoradas.
    telefones: v.telefones.filter((t) => t.numero.trim()),
  }
}

export function EntidadeNova() {
  return <Formulario />
}

export function EntidadeEditar() {
  const { id = '' } = useParams()
  const { data, error, isLoading } = useQuery({ queryKey: ['entidades', id], queryFn: () => entidadesApi.obter(id) })
  if (isLoading) return <p className="a-carregar">A carregar…</p>
  if (error instanceof ErroApi && error.estado === 404)
    return <p className="aviso">Entidade não encontrada ou sem acesso.</p>
  if (!data) return <p className="erro">Não foi possível carregar a entidade.</p>
  if (!data.acoes.editar) return <p className="aviso">Não tem permissão para editar esta entidade.</p>
  return <Formulario entidade={data} key={data.versao} />
}

function Formulario({ entidade }: { entidade?: Entidade }) {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const inicial = useMemo(() => (entidade ? deEntidade(entidade) : VAZIO), [entidade])
  const [v, setV] = useState<Valores>(inicial)
  const [erros, setErros] = useState<Record<string, unknown>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [aGravar, setAGravar] = useState(false)
  const [duplicados, setDuplicados] = useState<{ candidatos: Candidato[]; outros: number } | null>(null)
  const opcoes = useQuery({ queryKey: ['entidades', 'opcoes'], queryFn: entidadesApi.opcoes, staleTime: 60_000 })

  const alterado = JSON.stringify(v) !== JSON.stringify(inicial)
  const cp = usePersonalizados(ECRA_ENTIDADE, comoRegistoCp(entidade))
  const guarda = useGuardaSaida(alterado || cp.alterado)

  const [sugestoes, setSugestoes] = useState<Candidato[]>([])
  // Verificação prévia de possíveis duplicados (só em criação), enquanto se preenche.
  useEffect(() => {
    if (entidade) return
    const nomeCompleto = [v.nome, v.tipo_pessoa === 'singular' ? v.apelido : ''].filter(Boolean).join(' ')
    if (!v.nif && !v.email && nomeCompleto.length < 4 && !v.telefones.some((t) => t.numero.length >= 6)) {
      setSugestoes([])
      return
    }
    const t = setTimeout(() => {
      entidadesApi
        .duplicados({ nif: v.nif, email: v.email, nome: nomeCompleto, telefones: v.telefones })
        .then((r) => setSugestoes(r.candidatos))
        .catch(() => setSugestoes([]))
    }, 600)
    return () => clearTimeout(t)
  }, [entidade, v.nif, v.email, v.nome, v.apelido, v.tipo_pessoa, v.telefones])

  function mudar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setV((atual) => ({ ...atual, [campo]: valor }))
  }

  const erro = (campo: string) => erros[campo] as string[] | undefined

  async function gravar(confirmarDuplicado = false) {
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    try {
      const corpo = { ...paraApi(v), confirmar_duplicado: confirmarDuplicado }
      const r = entidade
        ? await entidadesApi.atualizar(entidade.id, {
            ...corpo,
            campos_personalizados: cp.paraApi(),
            versao: entidade.versao,
          })
        : await entidadesApi.criar({ ...corpo, campos_personalizados: cp.paraApi() })
      guarda.libertar()
      setDuplicados(null)
      qc.invalidateQueries({ queryKey: ['entidades'] })
      qc.setQueryData(['entidades', String(r.id)], r)
      navegar(`/entidades/${r.id}`, { replace: !entidade })
    } catch (e) {
      if (e instanceof ErroApi && e.estado === 400) {
        setErros(e.campos)
        setErroGeral('Corrija os campos assinalados.')
      } else if (e instanceof ErroApi && e.estado === 409 && e.corpo.codigo === 'possivel_duplicado') {
        setDuplicados({ candidatos: e.corpo.candidatos as Candidato[], outros: e.corpo.outros as number })
      } else if (e instanceof ErroApi && e.estado === 409) {
        setErroGeral(e.message)
      } else if (e instanceof ErroApi && e.estado === 403) {
        setErroGeral(e.message)
      } else {
        setErroGeral('Não foi possível gravar. Verifique a ligação e tente de novo.')
      }
    } finally {
      setAGravar(false)
    }
  }

  function submeter(ev: FormEvent) {
    ev.preventDefault()
    void gravar()
  }

  const o = opcoes.data
  const singular = v.tipo_pessoa === 'singular'
  const lista = (x?: { id: number; nome: string }[]) => (x ?? []).map((i) => ({ valor: i.id, nome: i.nome }))
  const texto = (campo: keyof Valores, rotulo: string, extra: { largo?: boolean } = {}) => (
    <CampoTexto
      rotulo={rotulo}
      largo={extra.largo}
      value={v[campo] as string}
      onChange={(e) => mudar(campo, e.target.value as never)}
      erro={erro(campo)}
    />
  )

  const selecao = (campo: keyof Valores, rotulo: string, itens?: { id: number; nome: string }[]) => (
    <CampoSelecao
      rotulo={rotulo}
      value={v[campo] as string}
      vazio="—"
      onChange={(e) => mudar(campo, e.target.value as never)}
      opcoes={lista(itens)}
      erro={erro(campo)}
    />
  )
  const areaTexto = (campo: keyof Valores, rotulo: string) => (
    <CampoAreaTexto
      rotulo={rotulo}
      value={v[campo] as string}
      onChange={(e) => mudar(campo, e.target.value as never)}
      erro={erro(campo)}
    />
  )

  const avisoDuplicados =
    sugestoes.length > 0 && !duplicados ? (
      <div className="aviso-duplicados" role="status">
        <strong>Possíveis duplicados:</strong>
        <ul>
          {sugestoes.map((c) => (
            <li key={c.id}>
              <Link to={`/entidades/${c.id}`} target="_blank">
                {c.referencia} · {c.nome_completo}
              </Link>{' '}
              <small>({c.motivos.map((m) => MOTIVOS[m]).join(', ')})</small>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  function desenharCampo(c: string): ReactNode {
    if (!singular && SO_SINGULAR.has(c)) return null
    switch (c) {
      case 'tipo_pessoa':
        return (
          <CampoSelecao
            rotulo="Tipo de pessoa"
            value={v.tipo_pessoa}
            onChange={(e) => mudar('tipo_pessoa', e.target.value as Valores['tipo_pessoa'])}
            opcoes={o?.tipos_pessoa ?? [{ valor: 'singular', nome: 'Pessoa singular' }]}
            erro={erro('tipo_pessoa')}
          />
        )
      case 'nome':
        return (
          <CampoTexto
            rotulo={singular ? 'Nome' : 'Denominação social'}
            required
            value={v.nome}
            onChange={(e) => mudar('nome', e.target.value)}
            erro={erro('nome')}
            autoFocus={!entidade}
          />
        )
      case 'apelido':
        return texto('apelido', 'Apelido')
      case 'nif':
        return (
          <CampoTexto
            rotulo={singular ? 'NIF' : 'NIPC'}
            inputMode={v.pais_fiscal === 'PT' ? 'numeric' : 'text'}
            value={v.nif}
            onChange={(e) => mudar('nif', e.target.value)}
            erro={erro('nif')}
          />
        )
      case 'pais_fiscal':
        return (
          <CampoTexto
            rotulo="País fiscal"
            value={v.pais_fiscal}
            maxLength={2}
            onChange={(e) => mudar('pais_fiscal', e.target.value.toUpperCase())}
            erro={erro('pais_fiscal')}
            ajuda="Código ISO (PT, ES, FR…). O NIF só é validado para PT."
          />
        )
      case 'telefones':
        return (
          <CampoTelefones
            valores={v.telefones}
            aoMudar={(t) => mudar('telefones', t)}
            tipos={o?.tipos_telefone ?? []}
            erros={erros.telefones}
          />
        )
      case 'email':
        return (
          <CampoTexto
            rotulo="Email"
            type="email"
            largo
            value={v.email}
            onChange={(e) => mudar('email', e.target.value)}
            erro={erro('email')}
          />
        )
      case 'rua':
        return texto('rua', 'Rua', { largo: true })
      case 'numero_policia':
        return texto('numero_policia', 'N.º de polícia')
      case 'complemento':
        return (
          <CampoTexto
            rotulo="Complemento"
            value={v.complemento}
            onChange={(e) => mudar('complemento', e.target.value)}
            erro={erro('complemento')}
            ajuda="Andar, fração, lote…"
          />
        )
      case 'codigo_postal':
        return (
          <CampoTexto
            rotulo="Código postal"
            placeholder="0000-000"
            value={v.codigo_postal}
            onChange={(e) => mudar('codigo_postal', e.target.value)}
            erro={erro('codigo_postal')}
          />
        )
      case 'localidade':
        return texto('localidade', 'Localidade')
      case 'freguesia':
        return (
          <SeletorLocalizacao
            freguesia={v.freguesia}
            atual={entidade?.freguesia === v.freguesia ? entidade?.localizacao : null}
            aoMudar={(f) => mudar('freguesia', f)}
          />
        )
      case 'zona_comercial':
        return selecao('zona_comercial', 'Zona', o?.zonas_comerciais)
      case 'data_nascimento':
        return (
          <CampoTexto
            rotulo="Data de nascimento"
            type="date"
            value={v.data_nascimento}
            onChange={(e) => mudar('data_nascimento', e.target.value)}
            erro={erro('data_nascimento')}
          />
        )
      case 'estado_civil':
        return selecao('estado_civil', 'Estado civil', o?.estados_civis)
      case 'regime_casamento':
        return selecao('regime_casamento', 'Regime de casamento', o?.regimes_casamento)
      case 'nacionalidade':
        return texto('nacionalidade', 'Nacionalidade')
      case 'documento_identificacao':
        return texto('documento_identificacao', 'CC/Passaporte')
      case 'naturalidade_freguesia':
        return texto('naturalidade_freguesia', 'Freguesia de naturalidade')
      case 'naturalidade_concelho':
        return texto('naturalidade_concelho', 'Concelho de naturalidade')
      case 'empresa':
        return texto('empresa', 'Empresa')
      case 'cargo':
        return texto('cargo', 'Cargo')
      case 'observacoes_pessoais':
        return areaTexto('observacoes_pessoais', 'Observações (dados pessoais)')
      case 'papeis':
        return (
          <CampoMultiplo
            rotulo="Tipo de cliente"
            opcoes={o?.papeis ?? []}
            valores={v.papeis}
            aoMudar={(p) => mudar('papeis', p)}
            erro={erro('papeis')}
          />
        )
      case 'status':
        return (
          <CampoSelecao
            rotulo="Status"
            value={v.status}
            vazio={entidade ? undefined : 'Por omissão: Ativo'}
            onChange={(e) => mudar('status', e.target.value)}
            opcoes={lista(o?.status)}
            erro={erro('status')}
          />
        )
      case 'origem':
        return (
          <CampoSelecao
            rotulo="Origem do contacto"
            value={v.origem}
            vazio="—"
            onChange={(e) => mudar('origem', e.target.value)}
            opcoes={lista(o?.origens)}
            erro={erro('origem')}
            ajuda={o && o.origens.length === 0 ? 'Sem origens configuradas (Configurações).' : undefined}
          />
        )
      case 'responsavel':
        return (
          <CampoResponsavel
            modulo="entidades"
            valor={v.responsavel}
            atual={entidade ? { id: entidade.responsavel, nome: entidade.responsavel_nome } : null}
            aoMudar={(x) => mudar('responsavel', x)}
            erro={erro('responsavel')}
          />
        )
      case 'quem_recomendou':
        return (
          <SeletorPesquisavel
            rotulo="Quem recomendou"
            chave="entidades"
            procurar={entidadesApi.procurar}
            valor={v.quem_recomendou}
            aoMudar={(x) => mudar('quem_recomendou', x)}
            excluir={entidade ? [entidade.id] : []}
            erro={erro('quem_recomendou')?.join(' ')}
            placeholder="Escreva o nome, NIF ou referência"
          />
        )
      case 'imovel_contacto':
        return (
          <SeletorPesquisavel
            rotulo="Imóvel de contacto"
            chave="imoveis"
            procurar={procurarImoveis}
            valor={v.imovel_contacto}
            aoMudar={(x) => mudar('imovel_contacto', x)}
            erro={erro('imovel_contacto')?.join(' ')}
            placeholder="Ex.: 10 T3 Maia"
          />
        )
      case 'visitou_imovel_contacto':
        return (
          <CampoSelecao
            rotulo="Visitou o imóvel de contacto"
            value={v.visitou_imovel_contacto}
            vazio="—"
            onChange={(e) => mudar('visitou_imovel_contacto', e.target.value as Valores['visitou_imovel_contacto'])}
            opcoes={[
              { valor: 'sim', nome: 'Sim' },
              { valor: 'nao', nome: 'Não' },
            ]}
            erro={erro('visitou_imovel_contacto')}
          />
        )
      case 'motivo_nao_visitou':
        return v.visitou_imovel_contacto === 'nao' ? areaTexto('motivo_nao_visitou', 'Porque não visitou') : null
      case 'consentimento_marketing':
        return (
          <CampoSelecao
            rotulo="Consentimento de marketing"
            value={v.consentimento_marketing}
            onChange={(e) => mudar('consentimento_marketing', e.target.value)}
            opcoes={o?.consentimentos ?? []}
            erro={erro('consentimento_marketing')}
          />
        )
      case 'consentimento_marketing_em':
        return (
          <CampoTexto
            rotulo="Data do consentimento"
            type="date"
            value={v.consentimento_marketing_em}
            onChange={(e) => mudar('consentimento_marketing_em', e.target.value)}
            erro={erro('consentimento_marketing_em')}
            required={v.consentimento_marketing === 'concedido'}
          />
        )
      case 'oposicao_marketing':
        return (
          <CampoCaixa
            rotulo="Oposição a marketing"
            checked={v.oposicao_marketing}
            onChange={(e) => mudar('oposicao_marketing', e.target.checked)}
            ajuda="Prevalece sobre qualquer consentimento."
          />
        )
      case 'observacoes':
        return areaTexto('observacoes', 'Observações')
    }
    return null
  }

  return (
    <form className="ficha ficha-edicao" onSubmit={submeter} noValidate>
      {entidade ? (
        <CabecalhoFicha e={entidade} />
      ) : (
        <div className="cabecalho-ficha">
          <div>
            <p className="ficha-referencia">
              <Link to="/entidades">Entidades</Link> / Nova
            </p>
            <h2 className="ficha-titulo">Nova entidade</h2>
          </div>
        </div>
      )}

      {erroGeral && (
        <p className="erro" role="alert">
          {erroGeral}
        </p>
      )}

      <BlocosConfiguraveis
        def={ECRA_ENTIDADE}
        modo="editar"
        personalizados={cp}
        campo={desenharCampo}
        erros={erros}
        depoisDoPrimeiro={avisoDuplicados}
        abertoInicial={(b) =>
          b.chave === 'morada'
            ? !entidade || !!entidade.rua
            : b.chave === 'pessoais'
              ? !entidade
              : b.chave === 'dados'
                ? false
                : b.chave === 'observacoes'
                  ? !!v.observacoes
                  : true
        }
      />

      <div className="barra-gravar">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar(entidade ? `/entidades/${entidade.id}` : '/entidades')}
        >
          Cancelar
        </button>
        <button type="submit" className="botao-principal" disabled={aGravar}>
          {aGravar ? 'A guardar…' : 'Guardar'}
        </button>
      </div>

      {guarda.dialogo}

      <Dialogo
        titulo="Possível duplicado"
        aberto={!!duplicados}
        aoFechar={() => setDuplicados(null)}
        acoes={
          <>
            <button type="button" className="botao-secundario" onClick={() => setDuplicados(null)}>
              Voltar ao formulário
            </button>
            <button type="button" className="botao-perigo" disabled={aGravar} onClick={() => void gravar(true)}>
              Gravar mesmo assim
            </button>
          </>
        }
      >
        <p>Já existe uma entidade com o mesmo NIF, email ou telefone. Confirme que não se trata da mesma pessoa.</p>
        {duplicados && duplicados.candidatos.length > 0 && (
          <ul>
            {duplicados.candidatos.map((c) => (
              <li key={c.id}>
                <Link to={`/entidades/${c.id}`} target="_blank">
                  {c.referencia} · {c.nome_completo}
                </Link>{' '}
                <small>
                  ({c.motivos.map((m) => MOTIVOS[m]).join(', ')}; responsável: {c.responsavel_nome})
                </small>
              </li>
            ))}
          </ul>
        )}
        {duplicados && duplicados.outros > 0 && (
          <p className="ajuda">
            Existe{duplicados.outros > 1 ? 'm' : ''} ainda {duplicados.outros} registo
            {duplicados.outros > 1 ? 's' : ''} semelhante{duplicados.outros > 1 ? 's' : ''} de outros utilizadores, a
            que não tem acesso. Fale com o Responsável de Equipa antes de criar um novo.
          </p>
        )}
      </Dialogo>
    </form>
  )
}
