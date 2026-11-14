/** Apresentação legível de um número E.164 (+351 912 345 678). */
export function formatarTelefone(e164: string): string {
  if (e164.startsWith('+351') && e164.length === 13) {
    const n = e164.slice(4)
    return `+351 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return e164
}
