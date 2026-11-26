import { NOMES_COR, type Indicadores } from './api'

/** Oito semanas com a cor de cada uma (só contam as ocorrências incluídas, Cap. 18). */
export function Semanas({ ind, compacto = false }: { ind: Indicadores; compacto?: boolean }) {
  return (
    <ol className={`semanas-plano${compacto ? ' compacto' : ''}`} aria-label="Progresso por semana">
      {ind.semanas.map((s) => (
        <li
          key={s.semana}
          className={`semana-chip cor-${s.cor}`}
          title={`Semana ${s.semana}: ${s.concluidas} de ${s.incluidas} concluídas (${NOMES_COR[s.cor]})`}
        >
          <span>{compacto ? s.semana : `${s.semana}ª`}</span>
          {!compacto && (
            <small>
              {s.concluidas}/{s.incluidas}
            </small>
          )}
        </li>
      ))}
    </ol>
  )
}
