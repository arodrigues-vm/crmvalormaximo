import { Link } from 'react-router-dom'

import { CampoAreaTexto, CampoMultiplo, CampoSelecao, CampoTexto, Dado } from './campos'
import type { CampoPersonalizadoDef } from './disposicao'
import { dataPt, formatarEuros, formatarTelefone } from './formatar'
import { CAMINHOS, procurarRegistos, type EstadoPersonalizados, type NomeCp, type RegistoCp } from './personalizados'
import { RotuloCtx } from './rotulo'
import { SeletorPesquisavel } from './SeletorPesquisavel'

const SIM_NAO = [
  { valor: 'sim', nome: 'Sim' },
  { valor: 'nao', nome: 'Não' },
]

/** Campo acrescentado pelo Administrador, no formulário (D-44). */
export function EditarCampoPersonalizado({
  c,
  estado,
  erro,
}: {
  c: CampoPersonalizadoDef
  estado: EstadoPersonalizados
  erro?: string[]
}) {
  const v = estado.valores[c.chave]
  const mudar = estado.aoMudar
  const comum = { rotulo: c.nome, erro, ajuda: c.ajuda || undefined, required: c.obrigatorio }
  const texto = v === null || v === undefined ? '' : String(v)
  const ids = Array.isArray(v) ? v : typeof v === 'number' ? [v] : []
  // Opções ativas, mais as já escolhidas que entretanto foram desativadas.
  const opcoes = c.opcoes.filter((o) => o.ativo || ids.includes(o.id))
  let no
  switch (c.tipo) {
    case 'texto_longo':
      no = <CampoAreaTexto {...comum} value={texto} onChange={(e) => mudar(c.chave, e.target.value)} />
      break
    case 'sim_nao':
      no = (
        <CampoSelecao
          {...comum}
          vazio="—"
          value={v === true ? 'sim' : v === false ? 'nao' : ''}
          onChange={(e) => mudar(c.chave, e.target.value === '' ? null : e.target.value === 'sim')}
          opcoes={SIM_NAO}
        />
      )
      break
    case 'lista':
      no = (
        <CampoSelecao
          {...comum}
          vazio="—"
          value={texto}
          onChange={(e) => mudar(c.chave, e.target.value ? Number(e.target.value) : null)}
          opcoes={opcoes.map((o) => ({ valor: o.id, nome: o.nome }))}
          ajuda={
            c.ajuda || (c.opcoes.length === 0 ? 'Sem opções: acrescente-as em Configurações → Listas.' : undefined)
          }
        />
      )
      break
    case 'lista_multipla':
      no = <CampoMultiplo {...comum} opcoes={opcoes} valores={ids} aoMudar={(x) => mudar(c.chave, x)} />
      break
    case 'relacao': {
      const atual = estado.titulos[c.chave]?.[0] ?? (ids.length ? { id: ids[0], titulo: `#${ids[0]}` } : null)
      no = (
        <SeletorPesquisavel
          rotulo={c.nome}
          chave={`cp-${c.modulo_relacao}`}
          procurar={procurarRegistos(c.modulo_relacao)}
          valor={atual}
          aoMudar={(x) => mudar(c.chave, x ? x.id : null, x ? [x] : [])}
          erro={erro?.join(' ')}
          placeholder="Escreva para procurar…"
        />
      )
      break
    }
    case 'relacao_multipla': {
      const escolhidos = estado.titulos[c.chave] ?? ids.map((i) => ({ id: i, titulo: `#${i}` }))
      no = (
        <div className="campo largo">
          <SeletorPesquisavel
            rotulo={c.nome}
            chave={`cp-${c.modulo_relacao}`}
            procurar={procurarRegistos(c.modulo_relacao)}
            valor={null}
            excluir={ids}
            aoMudar={(x) => x && mudar(c.chave, [...ids, x.id], [...escolhidos, x])}
            erro={erro?.join(' ')}
            placeholder="Escreva para acrescentar…"
          />
          {escolhidos.length > 0 && (
            <div className="fichas-escolhidas">
              {escolhidos.map((x) => (
                <span key={x.id} className="pilula">
                  {x.titulo}
                  <button
                    type="button"
                    className="ligacao-botao"
                    aria-label={`Retirar ${x.titulo}`}
                    onClick={() =>
                      mudar(
                        c.chave,
                        ids.filter((i) => i !== x.id),
                        escolhidos.filter((y) => y.id !== x.id),
                      )
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )
      break
    }
    default: {
      const tipos: Record<string, { type?: string; inputMode?: 'numeric' | 'decimal'; rotulo?: string }> = {
        inteiro: { inputMode: 'numeric' },
        decimal: { inputMode: 'decimal' },
        moeda: { inputMode: 'decimal', rotulo: `${c.nome} (€)` },
        data: { type: 'date' },
        email: { type: 'email' },
        url: { type: 'url' },
        telefone: { type: 'tel' },
      }
      const t = tipos[c.tipo] ?? {}
      no = (
        <CampoTexto
          {...comum}
          rotulo={t.rotulo ?? c.nome}
          type={t.type}
          inputMode={t.inputMode}
          placeholder={c.tipo === 'url' ? 'https://…' : undefined}
          value={texto}
          onChange={(e) => mudar(c.chave, e.target.value)}
        />
      )
    }
  }
  // O nome vem da definição do campo; não se aplica a mudança de nomes dos campos de origem.
  return <RotuloCtx.Provider value={null}>{no}</RotuloCtx.Provider>
}

function Ligacoes({ nomes, ecra }: { nomes?: NomeCp[]; ecra: string }) {
  if (!nomes?.length) return null
  return (
    <>
      {nomes.map((n, i) => (
        <span key={n.id}>
          {i > 0 && ', '}
          {n.acessivel && CAMINHOS[ecra] ? (
            <Link to={`${CAMINHOS[ecra]}/${n.id}`}>{n.titulo}</Link>
          ) : (
            <span className="vazio">{n.titulo}</span>
          )}
        </span>
      ))}
    </>
  )
}

/** Campo acrescentado pelo Administrador, na ficha de consulta (D-44). */
export function VerCampoPersonalizado({ c, registo }: { c: CampoPersonalizadoDef; registo: RegistoCp }) {
  const v = registo.campos_personalizados?.[c.chave]
  const nomes = registo.campos_personalizados_nomes?.[c.chave]
  let conteudo: React.ReactNode = null
  if (v !== null && v !== undefined && v !== '') {
    switch (c.tipo) {
      case 'lista':
      case 'lista_multipla':
        conteudo = nomes?.map((n) => n.titulo).join(', ')
        break
      case 'relacao':
      case 'relacao_multipla':
        conteudo = <Ligacoes nomes={nomes} ecra={c.modulo_relacao} />
        break
      case 'sim_nao':
        conteudo = v ? 'Sim' : 'Não'
        break
      case 'moeda':
        conteudo = formatarEuros(String(v))
        break
      case 'decimal':
        conteudo = Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 6 })
        break
      case 'data':
        conteudo = dataPt(String(v))
        break
      case 'telefone':
        conteudo = formatarTelefone(String(v))
        break
      case 'email':
        conteudo = <a href={`mailto:${v}`}>{String(v)}</a>
        break
      case 'url':
        conteudo = (
          <a href={String(v)} target="_blank" rel="noopener noreferrer">
            Abrir
          </a>
        )
        break
      case 'texto_longo':
        conteudo = <span className="texto-livre">{String(v)}</span>
        break
      default:
        conteudo = String(v)
    }
  }
  return (
    <RotuloCtx.Provider value={null}>
      <Dado rotulo={c.nome} largo={c.tipo === 'texto_longo' || c.tipo === 'relacao_multipla'}>
        {conteudo}
      </Dado>
    </RotuloCtx.Provider>
  )
}
