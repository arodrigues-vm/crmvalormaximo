import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da tarefa de pós-venda; o Administrador pode alterá-la (D-43). */
export const ECRA_TAREFA: DefinicaoEcra = {
  modulo: 'tarefas',
  nome: 'Pós-Venda (tarefas)',
  padrao: [
    {
      chave: 'tarefa',
      titulo: 'Tarefa',
      campos: ['titulo', 'transacao', 'cliente', 'imovel', 'estado', 'prioridade', 'prazo', 'responsavel'],
    },
    { chave: 'descricao', titulo: 'Descrição', campos: ['descricao', 'categoria', 'modelo'] },
  ],
  rotulos: {
    titulo: 'Título',
    transacao: 'Transação',
    cliente: 'Cliente (só na consulta)',
    imovel: 'Imóvel (só na consulta)',
    estado: 'Estado',
    prioridade: 'Prioridade',
    prazo: 'Prazo',
    responsavel: 'Responsável',
    descricao: 'Descrição',
    categoria: 'Categoria',
    modelo: 'Modelo de origem (só na consulta)',
  },
}
