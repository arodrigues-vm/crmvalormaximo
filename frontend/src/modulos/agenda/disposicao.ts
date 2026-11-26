import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem do compromisso da Agenda; o Administrador pode alterá-la (D-43). */
export const ECRA_COMPROMISSO: DefinicaoEcra = {
  modulo: 'agenda',
  nome: 'Agenda (compromissos)',
  padrao: [
    {
      chave: 'compromisso',
      titulo: 'Compromisso',
      campos: ['titulo', 'tipo', 'inicio', 'fim', 'local', 'estado', 'responsavel'],
    },
    { chave: 'ligacoes', titulo: 'Com quem / onde', campos: ['entidade', 'imovel'] },
    { chave: 'descricao', titulo: 'Descrição', campos: ['descricao'] },
  ],
  rotulos: {
    titulo: 'Título',
    tipo: 'Tipo',
    inicio: 'Início',
    fim: 'Fim',
    local: 'Local',
    estado: 'Estado (só na consulta)',
    responsavel: 'Responsável',
    entidade: 'Entidade',
    imovel: 'Imóvel',
    descricao: 'Descrição',
  },
}
