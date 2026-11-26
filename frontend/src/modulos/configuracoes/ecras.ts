import type { DefinicaoEcra } from '../../componentes/disposicao'
import { ECRA_AGENCIA, ECRA_AGENTE } from '../agentes/disposicao'
import { ECRA_ANGARIACAO } from '../angariacoes/disposicao'
import { ECRA_ENTIDADE } from '../entidades/disposicao'
import { ECRA_MEMBRO } from '../equipa/disposicao'
import { ECRA_IMOVEL } from '../imoveis/disposicao'
import { ECRA_OPORTUNIDADE } from '../oportunidades/disposicao'
import { ECRA_PROCURA } from '../procuras/disposicao'
import { ECRA_PROPOSTA } from '../propostas/disposicao'
import { ECRA_TRANSACAO } from '../transacoes/disposicao'
import { ECRA_INTERESSE, ECRA_VISITA } from '../visitas/disposicao'

/** Ecrãs com disposição configurável (D-43). Cada módulo novo acrescenta aqui a sua definição. */
export const ECRAS: DefinicaoEcra[] = [
  ECRA_ENTIDADE,
  ECRA_IMOVEL,
  ECRA_ANGARIACAO,
  ECRA_OPORTUNIDADE,
  ECRA_PROCURA,
  ECRA_VISITA,
  ECRA_INTERESSE,
  ECRA_PROPOSTA,
  ECRA_TRANSACAO,
  ECRA_AGENTE,
  ECRA_AGENCIA,
  ECRA_MEMBRO,
]
