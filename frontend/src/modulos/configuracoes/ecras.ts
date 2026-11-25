import type { DefinicaoEcra } from '../../componentes/disposicao'
import { ECRA_ENTIDADE } from '../entidades/disposicao'
import { ECRA_IMOVEL } from '../imoveis/disposicao'

/** Ecrãs com disposição configurável (D-43). Cada módulo novo acrescenta aqui a sua definição. */
export const ECRAS: DefinicaoEcra[] = [ECRA_ENTIDADE, ECRA_IMOVEL]
