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
  it('imóvel não registado e agentes vão no pedido; «Compraria» fica no fim da avaliação', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/visitas/opcoes/': () => json(OPCOES),
      'GET /api/agentes/': () =>
        json({ count: 1, results: [{ id: 4, nome: 'Rita Externa', agencia_nome: 'Outra Agência', tipo_nome: null }] }),
      'POST /api/visitas/': () => json({ campos: {} }, 400),
    })
    desenhar('/visitas/nova')
    fireEvent.change(await screen.findByLabelText('O imóvel está registado no CRM?'), { target: { value: 'nao' } })
    fireEvent.change(screen.getByLabelText('Descrição do imóvel'), { target: { value: 'Moradia T4' } })
    fireEvent.change(screen.getByLabelText('Localização (breve)'), { target: { value: 'Matosinhos' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Agente responsável pelo imóvel' }), {
      target: { value: 'rita' },
    })
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Rita Externa/ }))
    fireEvent.change(screen.getByLabelText(/Data da visita/), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: /Avaliação do cliente/ }))
    const rotulos = [...document.querySelectorAll('label')].map((l) => l.textContent)
    expect(rotulos.indexOf('Compraria este imóvel?')).toBeGreaterThan(rotulos.indexOf('O que menos gostou?'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      imovel: null,
      imovel_descricao_livre: 'Moradia T4',
      imovel_localizacao: 'Matosinhos',
      agente_imovel: 4,
      agente_comprador: null,
    })
  })

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

  it('os interesses estão no menu como «Seguimento Compradores» (D-45)', async () => {
    simularApi({
      '/api/auth/eu/': () => json(UTIL),
      '/api/interesses/': () => json({ count: 0, results: [] }),
    })
    desenhar('/visitas/interesses')
    const ligacao = await screen.findByRole('link', { name: 'Seguimento Compradores' })
    expect(ligacao).toHaveAttribute('href', '/visitas/interesses')
    expect(ligacao).toHaveClass('active')
    expect(screen.getByRole('link', { name: 'Visitas' })).not.toHaveClass('active')
    expect(screen.getByRole('heading', { level: 1, name: 'Seguimento Compradores' })).toBeInTheDocument()
  })
})
