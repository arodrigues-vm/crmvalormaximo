import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErroApi } from '../../api/cliente'
import { Bloco } from '../../componentes/Bloco'
import { CampoTelefones, type TelefoneEditavel } from '../../componentes/CampoTelefones'
import { CampoAreaTexto, CampoCaixa, CampoMultiplo, CampoSelecao, CampoTexto } from '../../componentes/campos'
import { Dialogo } from '../../componentes/Dialogo'
import { SeletorLocalizacao } from '../../componentes/SeletorLocalizacao'
import { SeletorPesquisavel, type OpcaoPesquisa } from '../../componentes/SeletorPesquisavel'
import { useGuardaSaida } from '../../componentes/useGuardaSaida'
import { procurarImoveis } from '../imoveis/api'
import { entidadesApi, MOTIVOS, type Candidato, type Entidade, type RegistoLigado } from './api'
import { CabecalhoFicha } from './EntidadeConsulta'

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

const BLOCOS: Record<string, string[]> = {
  identificacao: ['tipo_pessoa', 'nome', 'apelido', 'pais_fiscal', 'nif'],
  contactos: ['email', 'telefones'],
  morada: ['rua', 'numero_policia', 'complemento', 'codigo_postal', 'localidade', 'freguesia', 'zona_comercial'],
  pessoais: [
    'data_nascimento',
    'estado_civil',
    'regime_casamento',
    'nacionalidade',
    'documento_identificacao',
    'naturalidade_freguesia',
    'naturalidade_concelho',
    'empresa',
    'cargo',
    'observacoes_pessoais',
  ],
  classificacao: [
    'papeis',
    'status',
    'origem',
    'quem_recomendou',
    'imovel_contacto',
    'visitou_imovel_contacto',
    'motivo_nao_visitou',
    'responsavel',
  ],
  dados: ['consentimento_marketing', 'consentimento_marketing_em', 'oposicao_marketing'],
  observacoes: ['observacoes'],
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
  const guarda = useGuardaSaida(alterado)

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
  const temErros = (bloco: string) => BLOCOS[bloco].some((c) => erros[c])

  async function gravar(confirmarDuplicado = false) {
    setAGravar(true)
    setErros({})
    setErroGeral(null)
    try {
      const corpo = { ...paraApi(v), confirmar_duplicado: confirmarDuplicado }
      const r = entidade
        ? await entidadesApi.atualizar(entidade.id, { ...corpo, versao: entidade.versao })
        : await entidadesApi.criar(corpo)
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

      <Bloco titulo="Identificação" forcarAberto={temErros('identificacao')}>
        <div className="grelha-campos">
          <CampoSelecao
            rotulo="Tipo de pessoa"
            value={v.tipo_pessoa}
            onChange={(e) => mudar('tipo_pessoa', e.target.value as Valores['tipo_pessoa'])}
            opcoes={o?.tipos_pessoa ?? [{ valor: 'singular', nome: 'Pessoa singular' }]}
            erro={erro('tipo_pessoa')}
          />
          <CampoTexto
            rotulo={singular ? 'Nome' : 'Denominação social'}
            required
            value={v.nome}
            onChange={(e) => mudar('nome', e.target.value)}
            erro={erro('nome')}
            autoFocus={!entidade}
          />
          {singular && (
            <CampoTexto
              rotulo="Apelido"
              value={v.apelido}
              onChange={(e) => mudar('apelido', e.target.value)}
              erro={erro('apelido')}
            />
          )}
          <CampoTexto
            rotulo={singular ? 'NIF' : 'NIPC'}
            inputMode={v.pais_fiscal === 'PT' ? 'numeric' : 'text'}
            value={v.nif}
            onChange={(e) => mudar('nif', e.target.value)}
            erro={erro('nif')}
          />
          <CampoTexto
            rotulo="País fiscal"
            value={v.pais_fiscal}
            maxLength={2}
            onChange={(e) => mudar('pais_fiscal', e.target.value.toUpperCase())}
            erro={erro('pais_fiscal')}
            ajuda="Código ISO (PT, ES, FR…). O NIF só é validado para PT."
          />
        </div>
      </Bloco>

      {sugestoes.length > 0 && !duplicados && (
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
      )}

      <Bloco titulo="Contactos" forcarAberto={temErros('contactos')}>
        <div className="grelha-campos">
          <CampoTelefones
            valores={v.telefones}
            aoMudar={(t) => mudar('telefones', t)}
            tipos={o?.tipos_telefone ?? []}
            erros={erros.telefones}
          />
          <CampoTexto
            rotulo="Email"
            type="email"
            largo
            value={v.email}
            onChange={(e) => mudar('email', e.target.value)}
            erro={erro('email')}
          />
        </div>
      </Bloco>

      <Bloco titulo="Morada" forcarAberto={temErros('morada')} abertoInicial={!!entidade?.rua || !entidade}>
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
            atual={entidade?.freguesia === v.freguesia ? entidade?.localizacao : null}
            aoMudar={(f) => mudar('freguesia', f)}
          />
          <CampoSelecao
            rotulo="Zona"
            value={v.zona_comercial}
            vazio="—"
            onChange={(e) => mudar('zona_comercial', e.target.value)}
            opcoes={lista(o?.zonas_comerciais)}
            erro={erro('zona_comercial')}
          />
        </div>
      </Bloco>

      {singular && (
        <Bloco titulo="Dados pessoais" forcarAberto={temErros('pessoais')} abertoInicial={!entidade}>
          <div className="grelha-campos">
            <CampoTexto
              rotulo="Data de nascimento"
              type="date"
              value={v.data_nascimento}
              onChange={(e) => mudar('data_nascimento', e.target.value)}
              erro={erro('data_nascimento')}
            />
            <CampoSelecao
              rotulo="Estado civil"
              value={v.estado_civil}
              vazio="—"
              onChange={(e) => mudar('estado_civil', e.target.value)}
              opcoes={lista(o?.estados_civis)}
              erro={erro('estado_civil')}
            />
            <CampoSelecao
              rotulo="Regime de casamento"
              value={v.regime_casamento}
              vazio="—"
              onChange={(e) => mudar('regime_casamento', e.target.value)}
              opcoes={lista(o?.regimes_casamento)}
              erro={erro('regime_casamento')}
            />
            {texto('nacionalidade', 'Nacionalidade')}
            {texto('documento_identificacao', 'CC/Passaporte')}
            {texto('naturalidade_freguesia', 'Freguesia de naturalidade')}
            {texto('naturalidade_concelho', 'Concelho de naturalidade')}
            {texto('empresa', 'Empresa')}
            {texto('cargo', 'Cargo')}
          </div>
          <CampoAreaTexto
            rotulo="Observações (dados pessoais)"
            value={v.observacoes_pessoais}
            onChange={(e) => mudar('observacoes_pessoais', e.target.value)}
            erro={erro('observacoes_pessoais')}
          />
        </Bloco>
      )}

      <Bloco titulo="Classificação" forcarAberto={temErros('classificacao')}>
        <div className="grelha-campos">
          <CampoMultiplo
            rotulo="Tipo de cliente"
            opcoes={o?.papeis ?? []}
            valores={v.papeis}
            aoMudar={(p) => mudar('papeis', p)}
            erro={erro('papeis')}
          />
          <CampoSelecao
            rotulo="Status"
            value={v.status}
            vazio={entidade ? undefined : 'Por omissão: Ativo'}
            onChange={(e) => mudar('status', e.target.value)}
            opcoes={lista(o?.status)}
            erro={erro('status')}
          />
          <CampoSelecao
            rotulo="Origem do contacto"
            value={v.origem}
            vazio="—"
            onChange={(e) => mudar('origem', e.target.value)}
            opcoes={(o?.origens ?? []).map((x) => ({ valor: x.id, nome: x.nome }))}
            erro={erro('origem')}
            ajuda={o && o.origens.length === 0 ? 'Sem origens configuradas (Configurações).' : undefined}
          />
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
          <SeletorPesquisavel
            rotulo="Imóvel de contacto"
            chave="imoveis"
            procurar={procurarImoveis}
            valor={v.imovel_contacto}
            aoMudar={(x) => mudar('imovel_contacto', x)}
            erro={erro('imovel_contacto')?.join(' ')}
            placeholder="Ex.: 10 T3 Maia"
          />
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
          {v.visitou_imovel_contacto === 'nao' && (
            <CampoAreaTexto
              rotulo="Porque não visitou"
              value={v.motivo_nao_visitou}
              onChange={(e) => mudar('motivo_nao_visitou', e.target.value)}
              erro={erro('motivo_nao_visitou')}
            />
          )}
          {erro('responsavel') && <p className="campo-erro largo">{erro('responsavel')}</p>}
        </div>
      </Bloco>

      <Bloco titulo="Proteção de dados" abertoInicial={false} forcarAberto={temErros('dados')}>
        <div className="grelha-campos">
          <CampoSelecao
            rotulo="Consentimento de marketing"
            value={v.consentimento_marketing}
            onChange={(e) => mudar('consentimento_marketing', e.target.value)}
            opcoes={o?.consentimentos ?? []}
            erro={erro('consentimento_marketing')}
          />
          <CampoTexto
            rotulo="Data do consentimento"
            type="date"
            value={v.consentimento_marketing_em}
            onChange={(e) => mudar('consentimento_marketing_em', e.target.value)}
            erro={erro('consentimento_marketing_em')}
            required={v.consentimento_marketing === 'concedido'}
          />
          <CampoCaixa
            rotulo="Oposição a marketing"
            checked={v.oposicao_marketing}
            onChange={(e) => mudar('oposicao_marketing', e.target.checked)}
            ajuda="Prevalece sobre qualquer consentimento."
          />
        </div>
      </Bloco>

      <Bloco titulo="Observações" abertoInicial={!!v.observacoes} forcarAberto={temErros('observacoes')}>
        <CampoAreaTexto
          rotulo="Observações"
          value={v.observacoes}
          onChange={(e) => mudar('observacoes', e.target.value)}
          erro={erro('observacoes')}
        />
      </Bloco>

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
