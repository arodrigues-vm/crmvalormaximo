import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da ficha de membro da Equipa; o Administrador pode alterá-la (D-43). */
export const ECRA_MEMBRO: DefinicaoEcra = {
  modulo: 'equipa',
  nome: 'Equipa (membros)',
  semPersonalizados: true,
  padrao: [
    {
      chave: 'profissionais',
      titulo: 'Dados profissionais',
      campos: ['nome', 'funcao_comercial', 'identificacao_profissional', 'nif', 'telefone', 'equipa'],
    },
    {
      chave: 'acesso',
      titulo: 'Acesso ao CRM',
      campos: ['email', 'perfil', 'ativo', 'password', 'mfa', 'ultimo_acesso', 'membro_desde'],
    },
    {
      chave: 'comissao',
      titulo: 'Comissão habitual',
      campos: ['comissao_modo', 'comissao_pct_angariacao', 'comissao_pct_venda', 'comissao_deducao'],
    },
  ],
  rotulos: {
    comissao_modo: 'Forma de cálculo da comissão',
    comissao_pct_angariacao: '% sobre o lado da angariação',
    comissao_pct_venda: '% sobre o lado da venda',
    comissao_deducao: 'Valor fixo que fica para a agência',
    nome: 'Nome',
    funcao_comercial: 'Função',
    identificacao_profissional: 'Identificação profissional',
    nif: 'NIF',
    telefone: 'Telefone',
    equipa: 'Equipa',
    email: 'Email (para entrar)',
    perfil: 'Perfil',
    ativo: 'Pode entrar no CRM',
    password: 'Palavra-passe (só na edição)',
    mfa: 'Início de sessão em dois passos (só na consulta)',
    ultimo_acesso: 'Último acesso (só na consulta)',
    membro_desde: 'Membro desde (só na consulta)',
  },
}
