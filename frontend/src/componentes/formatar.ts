/** Apresentação legível de um número E.164 (+351 912 345 678). */
export function formatarTelefone(e164: string): string {
  if (e164.startsWith('+351') && e164.length === 13) {
    const n = e164.slice(4)
    return `+351 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return e164
}

const euros = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const numero = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 })

/** Valores monetários chegam como texto decimal; null = desconhecido. */
export function formatarEuros(v: string | null | undefined): string | null {
  return v === null || v === undefined || v === '' ? null : euros.format(Number(v))
}

export function formatarArea(v: string | null | undefined): string | null {
  return v === null || v === undefined || v === '' ? null : `${numero.format(Number(v))} m²`
}

export function formatarPercentagem(v: string | null | undefined): string | null {
  return v === null || v === undefined || v === '' ? null : `${numero.format(Number(v))} %`
}

export const dataPt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT') : null)

export const momentoPt = (d: string) =>
  new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' })
