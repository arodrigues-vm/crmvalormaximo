import type { DefinicaoEcra } from '../../componentes/disposicao'

/** Disposição de origem da ficha de membro da Equipa; o Administrador pode alterá-la (D-43). */
export const ECRA_MEMBRO: DefinicaoEcra = {
  modulo: 'equipa',
  nome: 'Equipa (membros)',
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
  ],
  rotulos: {
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
