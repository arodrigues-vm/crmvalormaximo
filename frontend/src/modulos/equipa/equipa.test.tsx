import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar', 'transferir'].map((o) => [o, a])) as Record<
    string,
    string
  >

const ADMIN = {
  ...UTILIZADOR_CONSULTOR,
  perfil: 'administrador',
  permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, equipa: todas('todos'), entidades: todas('todos') },
}

const OPCOES = {
  perfis: [
    { valor: 'consultor', nome: 'Consultor' },
    { valor: 'responsavel', nome: 'Responsável de Equipa' },
  ],
  equipas: [{ id: 2, nome: 'Equipa Norte' }],
  pode_gerir: true,
}

afterEach(() => vi.restoreAllMocks())

describe('Equipa', () => {
  it('novo membro envia os dados profissionais, o perfil e a palavra-passe inicial', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      '/api/equipa/membros/opcoes/': () => json(OPCOES),
      'POST /api/equipa/membros/': () => json({ campos: {} }, 400),
    })
    desenhar('/equipa/novo')
    fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: 'Rita Ensaio' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'rita@exemplo.pt' } })
    fireEvent.change(screen.getByLabelText('Equipa'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/^Palavra-passe inicial/), { target: { value: 'Senha-Longa-2026!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      nome: 'Rita Ensaio',
      email: 'rita@exemplo.pt',
      perfil: 'consultor',
      equipa: 2,
      ativo: true,
      password: 'Senha-Longa-2026!',
    })
  })

  it('o campo Responsável aparece na entidade quando se pode atribuir a outros', async () => {
    simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      '/api/entidades/opcoes/': () =>
        json({
          papeis: [], origens: [], status: [], estados_civis: [], regimes_casamento: [], zonas_comerciais: [],
          tipos_pessoa: [{ valor: 'singular', nome: 'Pessoa singular' }], consentimentos: [], tipos_telefone: [],
          tipos_relacao: [], pode_criar: true, pode_transferir: true, pode_restaurar: true,
        }), // prettier-ignore
      '/api/telefone/paises/': () => json([]),
      '/api/localizacao/distritos/': () => json([]),
      '/api/equipa/responsaveis/': () =>
        json([
          { id: 1, nome: 'Administrador Demo', equipa: null },
          { id: 5, nome: 'Rita Ensaio', equipa: 'Equipa Norte' },
        ]),
    })
    desenhar('/entidades/nova')
    const campo = await screen.findByLabelText('Responsável')
    expect([...campo.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Eu próprio',
      'Administrador Demo',
      'Rita Ensaio (Equipa Norte)',
    ])
  })
})
