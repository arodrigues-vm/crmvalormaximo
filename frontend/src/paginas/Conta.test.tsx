import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../test/utilitarios'

afterEach(() => vi.restoreAllMocks())

describe('A minha conta', () => {
  it('desliga os dois passos com palavra-passe e código quando não é obrigatório', async () => {
    let ativa = true
    const pedidos = simularApi({
      '/api/auth/eu/': () => json({ ...UTILIZADOR_CONSULTOR, mfa_ativa: ativa, mfa_obrigatoria: false }),
      'POST /api/auth/mfa/desativar/': () => {
        ativa = false
        return json({ mfa_ativa: false })
      },
    })
    desenhar('/conta')
    fireEvent.change(await screen.findByLabelText('Palavra-passe'), { target: { value: 'segredo' } })
    fireEvent.change(screen.getByLabelText('Código do telemóvel'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Desligar o início de sessão em dois passos' }))
    expect(await screen.findByText(/foi desligado/)).toBeInTheDocument()
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toEqual({ password: 'segredo', codigo: '123456' })
  })

  it('quando é obrigatório explica onde o Administrador o torna opcional', async () => {
    simularApi({ '/api/auth/eu/': () => json({ ...UTILIZADOR_CONSULTOR, mfa_ativa: true, mfa_obrigatoria: true }) })
    desenhar('/conta')
    expect(await screen.findByText(/É obrigatório para o seu perfil/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desligar/ })).not.toBeInTheDocument()
  })
})
