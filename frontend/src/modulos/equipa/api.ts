import { pedido } from '../../api/cliente'

export interface Membro {
  id: number
  nome: string
  email: string
  perfil: string
  perfil_nome: string
  equipa: number | null
  equipa_nome: string | null
  funcao_comercial: string
  identificacao_profissional: string
  nif: string
  telefone: string
  telefone_e164: string
  ativo: boolean
  mfa_ativa: boolean
  ultimo_acesso: string | null
  date_joined: string
}

export interface GrupoEquipa {
  id: number
  nome: string
  ativa: boolean
  n_membros: number
}

export interface OpcoesEquipa {
  perfis: { valor: string; nome: string }[]
  equipas: { id: number; nome: string }[]
  pode_gerir: boolean
}

export const equipaApi = {
  listar: (params: Record<string, string>) =>
    pedido<{ count: number; results: Membro[] }>(`/api/equipa/membros/?${new URLSearchParams(params)}`),
  obter: (id: string | number) => pedido<Membro>(`/api/equipa/membros/${id}/`),
  criar: (dados: unknown) => pedido<Membro>('/api/equipa/membros/', { json: dados }),
  atualizar: (id: number, dados: unknown) =>
    pedido<Membro>(`/api/equipa/membros/${id}/`, { method: 'PATCH', json: dados }),
  reporMfa: (id: number) => pedido<Membro>(`/api/equipa/membros/${id}/repor_mfa/`, { method: 'POST' }),
  opcoes: () => pedido<OpcoesEquipa>('/api/equipa/membros/opcoes/'),
  equipas: () => pedido<GrupoEquipa[]>('/api/equipa/equipas/'),
  criarEquipa: (nome: string) => pedido<GrupoEquipa>('/api/equipa/equipas/', { json: { nome } }),
  atualizarEquipa: (id: number, dados: Partial<GrupoEquipa>) =>
    pedido<GrupoEquipa>(`/api/equipa/equipas/${id}/`, { method: 'PATCH', json: dados }),
  responsaveis: (modulo: string) =>
    pedido<{ id: number; nome: string; equipa: string | null }[]>(`/api/equipa/responsaveis/?modulo=${modulo}`),
}
