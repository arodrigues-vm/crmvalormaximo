import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar'].map((o) => [o, a])) as Record<string, string>

const UTIL = {
  ...UTILIZADOR_CONSULTOR,
  permissoes: { ...UTILIZADOR_CONSULTOR.permissoes, visitas: todas('atribuidos'), imoveis: todas('atribuidos') },
}

const OPCOES = {
  estados: [
    { id: 1, nome: 'Agendada', categoria: 'agendada' },
    { id: 3, nome: 'Realizada', categoria: 'realizada' },
  ],
  avaliacoes: [
    { id: 10, nome: 'Mau' },
    { id: 11, nome: 'Muito bom' },
  ],
  sim_nao: [{ id: 20, nome: 'Sim' }],
  criterios: [
    { campo: 'av_localizacao', nome: 'Localização / zona' },
    { campo: 'av_preco', nome: 'Preço' },
  ],
  tipos_interacao: [],
  pode_criar: true,
}

afterEach(() => vi.restoreAllMocks())

describe('Visitas', () => {
  it('formulário envia data, horas e a avaliação da ficha de visita', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/visitas/opcoes/': () => json(OPCOES),
      'GET /api/imoveis/5/': () => json({ id: 5, referencia: 'IMO-000005', localidade: 'Maia', nomes: {} }),
      'POST /api/visitas/': () => json({ campos: {} }, 400),
    })
    desenhar('/visitas/nova?imovel=5')
    fireEvent.change(await screen.findByLabelText(/Data da visita/), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Hora de entrada'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByRole('button', { name: /Avaliação do cliente/ }))
    await waitFor(() => expect(screen.getByLabelText('Preço').querySelectorAll('option').length).toBe(3))
    fireEvent.change(screen.getByLabelText('Preço'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Compraria este imóvel?'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      imovel: 5,
      data: '2026-12-01',
      hora_entrada: '10:00',
      av_preco: 10,
      av_localizacao: null,
      compraria: 20,
    })
  })

  it('lista mostra as próximas visitas a partir de hoje', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/visitas/opcoes/': () => json(OPCOES),
      'GET /api/visitas/': () =>
        json({
          count: 1,
          results: [
            {
              id: 1,
              referencia: 'VIS-000001',
              data: '2026-12-01',
              hora_entrada: '10:00:00',
              hora_saida: null,
              entidade: 7,
              entidade_nome: 'Bruno Ensaio',
              imovel: 5,
              imovel_descricao: 'IMO-000005 · T3 · Maia',
              estado_nome: 'Agendada',
              estado_categoria: 'agendada',
              responsavel_nome: 'Consultor Demo',
            },
          ],
        }),
    })
    desenhar('/visitas')
    expect(await screen.findByText('Bruno Ensaio')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
    const lista = pedidos.find((p) => p.url.pathname === '/api/visitas/' && p.metodo === 'GET')!
    expect(lista.url.searchParams.get('ordem')).toBe('proximas')
    expect(lista.url.searchParams.get('desde')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
