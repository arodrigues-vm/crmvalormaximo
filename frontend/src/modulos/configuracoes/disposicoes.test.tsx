import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const ADMIN = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: {
    ...UTILIZADOR_CONSULTOR.permissoes,
    configuracoes: Object.fromEntries(['consultar', 'editar', 'administrar'].map((o) => [o, 'todos'])),
  },
}

afterEach(() => vi.restoreAllMocks())

describe('Disposição dos ecrãs (D-43)', () => {
  it('o Administrador muda a ordem, move um campo para outro separador e guarda', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/disposicoes/imoveis/': () => json({ modulo: 'imoveis', blocos: null }),
      'GET /api/disposicoes/entidades/': () => json({ modulo: 'entidades', blocos: null }),
      'PUT /api/disposicoes/imoveis/': (_u, init) =>
        json({ modulo: 'imoveis', blocos: JSON.parse(String(init?.body)).blocos }),
    })
    desenhar('/configuracoes/disposicao')
    fireEvent.change(await screen.findByLabelText('Módulo'), { target: { value: 'imoveis' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Descer o separador Comercialização' }))
    const separadores = screen.getAllByLabelText(/^Separador \d+$/)
    expect(separadores[0]).toHaveValue('Identificação')
    fireEvent.change(screen.getByLabelText('Separador de Valor'), { target: { value: 'identificacao' } })
    fireEvent.change(separadores[0], { target: { value: 'Identificação do imóvel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PUT')).toBe(true))
    const blocos = (
      pedidos.find((p) => p.metodo === 'PUT')!.corpo as {
        blocos: { chave: string; titulo: string; campos: string[] }[]
      }
    ).blocos
    expect(blocos[0]).toMatchObject({ chave: 'identificacao', titulo: 'Identificação do imóvel' })
    expect(blocos[0].campos.at(-1)).toBe('preco')
    expect(blocos[1].chave).toBe('comercializacao')
    expect(blocos[1].campos).not.toContain('preco')
    expect(await screen.findByText('Disposição guardada.')).toBeInTheDocument()
  })

  it('só deixa remover separadores vazios', async () => {
    simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/disposicoes/entidades/': () => json({ modulo: 'entidades', blocos: null }),
    })
    desenhar('/configuracoes/disposicao')
    await screen.findByRole('button', { name: 'Acrescentar separador' })
    expect(screen.queryByRole('button', { name: /^Remover o separador/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Acrescentar separador' }))
    const novo = screen.getByRole('button', { name: 'Remover o separador Novo separador' })
    expect(within(novo.closest('li')!).getByText(/Separador vazio/)).toBeInTheDocument()
    fireEvent.click(novo)
    expect(screen.queryByDisplayValue('Novo separador')).toBeNull()
  })
})

describe('Nomes e campos acrescentados (D-44)', () => {
  it('muda o nome de um campo e cria um campo novo no separador escolhido', async () => {
    let campos: unknown[] = []
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/disposicoes/entidades/': () => json({ modulo: 'entidades', blocos: null, rotulos: {} }),
      'GET /api/campos-personalizados/': () =>
        json({
          campos,
          tipos: [
            { valor: 'texto', nome: 'Texto' },
            { valor: 'relacao', nome: 'Ligação a um registo de outro módulo' },
          ],
          modulos: [{ valor: 'imoveis', nome: 'Imóveis' }],
        }),
      'PUT /api/disposicoes/entidades/': (_u, init) => json({ modulo: 'entidades', ...JSON.parse(String(init?.body)) }),
      'POST /api/campos-personalizados/': (_u, init) => {
        const c = {
          id: 1,
          ecra: 'entidades',
          chave: 'cp_imovel_de_ferias',
          tipo_nome: 'Ligação a um registo de outro módulo',
          ativo: true,
          lista: null,
          opcoes: [],
          em_uso: 0,
          ...JSON.parse(String(init?.body)),
        }
        campos = [c]
        return json(c, 201)
      },
    })
    desenhar('/configuracoes/disposicao')
    fireEvent.change(await screen.findByLabelText('Nome de Email'), { target: { value: 'Correio eletrónico' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'PUT')).toBe(true))
    expect((pedidos.find((p) => p.metodo === 'PUT')!.corpo as { rotulos: object }).rotulos).toEqual({
      email: 'Correio eletrónico',
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Acrescentar campo' }))
    const dialogo = within(await screen.findByRole('dialog'))
    fireEvent.change(dialogo.getByLabelText(/^Nome do campo/), { target: { value: 'Imóvel de férias' } })
    fireEvent.change(dialogo.getByLabelText('Tipo de campo'), { target: { value: 'relacao' } })
    fireEvent.change(dialogo.getByLabelText('Liga a registos de'), { target: { value: 'imoveis' } })
    fireEvent.change(dialogo.getByLabelText('Separador'), { target: { value: 'contactos' } })
    fireEvent.click(dialogo.getByRole('button', { name: 'Criar campo' }))
    await waitFor(() => expect(pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(2))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      ecra: 'entidades',
      tipo: 'relacao',
      modulo_relacao: 'imoveis',
    })
    const blocos = (
      pedidos.filter((p) => p.metodo === 'PUT')[1].corpo as { blocos: { chave: string; campos: string[] }[] }
    ).blocos
    expect(blocos.find((b) => b.chave === 'contactos')!.campos).toContain('cp_imovel_de_ferias')
    expect(await screen.findByText('Campo «Imóvel de férias» criado.')).toBeInTheDocument()
  })
})
