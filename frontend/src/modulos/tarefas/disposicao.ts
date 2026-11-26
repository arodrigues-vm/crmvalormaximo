import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da tarefa de pós-venda; o Administrador pode alterá-la (D-43). */
export const ECRA_TAREFA: DefinicaoEcra = {
  modulo: 'tarefas',
  nome: 'Tarefas (gerais e de pós-venda)',
  padrao: [
    {
      chave: 'tarefa',
      titulo: 'Tarefa',
      campos: [
        'titulo',
        'transacao',
        'plano',
        'origem',
        'cliente',
        'imovel',
        'estado',
        'prioridade',
        'prazo',
        'responsavel',
      ],
    },
    { chave: 'descricao', titulo: 'Descrição', campos: ['descricao', 'categoria', 'modelo'] },
  ],
  rotulos: {
    titulo: 'Título',
    transacao: 'Transação (só no pós-venda)',
    origem: 'Ligada a (só nas tarefas gerais)',
    plano: 'Plano de marketing (só nas tarefas do plano)',
    cliente: 'Cliente (só na consulta)',
    imovel: 'Imóvel (só na consulta)',
    estado: 'Estado (só na consulta)',
    prioridade: 'Prioridade',
    prazo: 'Prazo',
    responsavel: 'Responsável',
    descricao: 'Descrição',
    categoria: 'Categoria',
    modelo: 'Modelo de origem (só na consulta)',
  },
}
