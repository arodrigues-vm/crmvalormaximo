import type { DefinicaoEcra } from '../../componentes/disposicao'
import { CAMPOS_AGENCIA, CAMPOS_AGENTE, MORADA_AGENCIA, OBSERVACOES } from './api'

const c = (l: { campo: string }[]) => l.map((x) => x.campo)
const rot = (l: { campo: string; rotulo: string }[]) => Object.fromEntries(l.map((x) => [x.campo, x.rotulo]))

/** Disposições de origem de Agentes e Agências; o Administrador pode alterá-las (D-43). */
export const ECRA_AGENTE: DefinicaoEcra = {
  modulo: 'agentes',
  nome: 'Agentes',
  padrao: [
    { chave: 'dados', titulo: 'Dados', campos: [...c(CAMPOS_AGENTE), 'agencia'] },
    { chave: 'observacoes', titulo: 'Observações', campos: c(OBSERVACOES) },
  ],
  rotulos: { ...rot(CAMPOS_AGENTE), agencia: 'Agência', ...rot(OBSERVACOES) },
}

export const ECRA_AGENCIA: DefinicaoEcra = {
  modulo: 'agencias',
  nome: 'Agências',
  padrao: [
    { chave: 'dados', titulo: 'Dados', campos: c(CAMPOS_AGENCIA) },
    { chave: 'morada', titulo: 'Morada', campos: [...c(MORADA_AGENCIA), 'freguesia'] },
    { chave: 'observacoes', titulo: 'Observações', campos: c(OBSERVACOES) },
  ],
  rotulos: {
    ...rot(CAMPOS_AGENCIA),
    ...rot(MORADA_AGENCIA),
    freguesia: 'Distrito, concelho e freguesia',
    ...rot(OBSERVACOES),
  },
}
