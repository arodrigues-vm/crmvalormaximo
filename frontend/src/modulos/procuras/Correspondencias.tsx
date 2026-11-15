import { Link } from 'react-router-dom'

import { formatarEuros } from '../../componentes/formatar'
import { urlFotografia } from '../imoveis/api'
import { NOMES_CRITERIOS, type Correspondencia, type Criterio } from './api'

const SIMBOLO: Record<Criterio['estado'], string> = { cumpre: '✓', nao_cumpre: '✗', desconhecido: '?' }
const GRUPO: Record<number, string> = {
  0: 'Dentro do orçamento',
  1: 'Dentro da tolerância',
  2: 'Preço por confirmar',
}

export function ListaCriterios({ criterios }: { criterios: Criterio[] }) {
  if (criterios.length === 0) return <small className="ajuda">Sem critérios definidos (só operação).</small>
  return (
    <ul className="criterios">
      {criterios.map((c) => (
        <li key={c.criterio} className={`criterio criterio-${c.estado}`} title={c.detalhe}>
          <span aria-hidden="true">{SIMBOLO[c.estado]}</span> {NOMES_CRITERIOS[c.criterio] ?? c.criterio}
          {c.obrigatorio && <small> (obrig.)</small>}
          <span className="criterio-detalhe">{c.detalhe}</span>
        </li>
      ))}
    </ul>
  )
}

export function CorrespondenciasProcura({ resultados }: { resultados: Correspondencia[] }) {
  if (resultados.length === 0)
    return <p className="ajuda">Nenhum imóvel disponível cumpre os critérios obrigatórios desta procura.</p>
  return (
    <ol className="correspondencias">
      {resultados.map((r) => (
        <li key={r.imovel.id}>
          <Link to={`/imoveis/${r.imovel.id}`} className="correspondencia-foto" aria-hidden="true" tabIndex={-1}>
            {r.imovel.fotografia ? (
              <img
                src={urlFotografia(r.imovel.fotografia.imovel, r.imovel.fotografia.versao, true)}
                alt=""
                loading="lazy"
              />
            ) : (
              <span className="miniatura-vazia" />
            )}
          </Link>
          <div className="correspondencia-corpo">
            <div className="correspondencia-titulo">
              <Link to={`/imoveis/${r.imovel.id}`}>
                <strong>{r.imovel.referencia}</strong> · {r.imovel.descricao}
              </Link>
              <span>{formatarEuros(r.imovel.preco) ?? 'Preço por indicar'}</span>
            </div>
            <div className="correspondencia-etiquetas">
              {GRUPO[r.grupo_preco] && <span className="etiqueta etiqueta-neutra">{GRUPO[r.grupo_preco]}</span>}
              {r.preferencias_total > 0 && (
                <span className="etiqueta etiqueta-sucesso">
                  {r.preferencias_cumpridas}/{r.preferencias_total} preferências
                </span>
              )}
              {r.obrigatorios_por_confirmar > 0 && (
                <span className="etiqueta etiqueta-aviso">
                  {r.obrigatorios_por_confirmar} obrigatório(s) por confirmar
                </span>
              )}
            </div>
            <ListaCriterios criterios={r.criterios} />
          </div>
        </li>
      ))}
    </ol>
  )
}
