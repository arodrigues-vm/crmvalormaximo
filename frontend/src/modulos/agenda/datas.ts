/** Datas civis da Agenda (Europe/Lisbon), em texto AAAA-MM-DD para não haver desvios de fuso. */

const ZONA = 'Europe/Lisbon'

export const hojeLisboa = () => new Date().toLocaleDateString('sv-SE', { timeZone: ZONA })

const comoData = (d: string) => new Date(`${d}T12:00:00Z`)
const comoTexto = (d: Date) => d.toISOString().slice(0, 10)

export function somarDias(d: string, n: number) {
  const x = comoData(d)
  x.setUTCDate(x.getUTCDate() + n)
  return comoTexto(x)
}

export function somarMeses(d: string, n: number) {
  const x = comoData(d.slice(0, 8) + '01')
  x.setUTCMonth(x.getUTCMonth() + n)
  return comoTexto(x)
}

/** Segunda-feira da semana de `d`. */
export function inicioSemana(d: string) {
  const dia = (comoData(d).getUTCDay() + 6) % 7
  return somarDias(d, -dia)
}

export function diasEntre(a: string, b: string) {
  const r: string[] = []
  for (let d = a; d <= b; d = somarDias(d, 1)) r.push(d)
  return r
}

/** Grelha do mês: semanas completas (segunda a domingo) que cobrem o mês de `d`. */
export function grelhaMes(d: string) {
  const primeiro = d.slice(0, 8) + '01'
  const ultimo = somarDias(somarMeses(primeiro, 1), -1)
  return diasEntre(inicioSemana(primeiro), somarDias(inicioSemana(ultimo), 6))
}

export type Vista = 'dia' | 'semana' | 'mes' | 'lista'

/** Intervalo a pedir ao servidor para a vista. */
export function intervalo(vista: Vista, d: string): [string, string] {
  if (vista === 'dia') return [d, d]
  if (vista === 'semana') return [inicioSemana(d), somarDias(inicioSemana(d), 6)]
  if (vista === 'mes') {
    const g = grelhaMes(d)
    return [g[0], g[g.length - 1]]
  }
  return [d, somarDias(d, 30)]
}

export function deslocar(vista: Vista, d: string, sentido: 1 | -1) {
  if (vista === 'dia') return somarDias(d, sentido)
  if (vista === 'semana') return somarDias(d, 7 * sentido)
  if (vista === 'mes') return somarMeses(d, sentido)
  return somarDias(d, 31 * sentido)
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export const nomeDia = (d: string, formato: 'long' | 'short' = 'long') =>
  maiuscula(
    comoData(d).toLocaleDateString('pt-PT', { weekday: formato, day: 'numeric', month: formato, timeZone: 'UTC' }),
  )

export const nomeMes = (d: string) =>
  maiuscula(comoData(d).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }))

export function tituloPeriodo(vista: Vista, d: string) {
  if (vista === 'dia') return nomeDia(d)
  if (vista === 'mes') return nomeMes(d)
  const [a, b] = intervalo(vista, d)
  return `${nomeDia(a, 'short')} – ${nomeDia(b, 'short')}`
}

/** Hora local (Lisboa) de um momento ISO. */
export const horaDe = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: ZONA })

/** Valor para <input type="datetime-local"> a partir de um momento ISO (em hora de Lisboa). */
export const paraCampo = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: ZONA }).slice(0, 16).replace(' ', 'T') : ''
