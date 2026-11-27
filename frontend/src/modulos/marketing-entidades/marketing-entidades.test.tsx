import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const todas = (a: string) =>
  Object.fromEntries(['consultar', 'criar', 'editar', 'eliminar', 'administrar'].map((o) => [o, a])) as Record<
    string,
    string
  >

const ADMIN = {
  ...UTILIZADOR_CONSULTOR,
  perfil: 'administrador',
  permissoes: {
    ...UTILIZADOR_CONSULTOR.permissoes,
    configuracoes: todas('todos'),
    'marketing-entidades': todas('todos'),
  },
}

const OPCOES = {
  fundamentos: [
    { valor: 'consentimento', nome: 'Consentimento (só entidades com consentimento concedido)' },
    { valor: 'interesse_legitimo', nome: 'Interesse legítimo / relação contratual (todas, exceto oposição)' },
  ],
  gatilhos: [
    { valor: 'entidade_criada', nome: 'Entidade criada' },
    { valor: 'contacto_registado', nome: 'Contacto registado' },
  ],
  criterios: [],
  papeis: [{ id: 5, nome: 'Comprador' }],
  status: [],
  origens: [],
  zonas: [],
  pode_configurar: true,
}

afterEach(() => vi.restoreAllMocks())

describe('Marketing de Entidades (D-55)', () => {
  it('sem planos instalados; o Administrador cria um plano com público, fundamento e tarefa repetida', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/marketing-entidades/planos/': () => json([]),
      '/api/marketing-entidades/planos/opcoes/': () => json(OPCOES),
      '/api/equipa/responsaveis/': () => json([{ id: 1, nome: 'Consultor Demo', equipa: null }]),
      'POST /api/marketing-entidades/planos/': () => json({ id: 1 }, 201),
    })
    desenhar('/configuracoes/marketing-entidades')
    expect(await screen.findByText('Ainda não há planos.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Novo plano' }))
    fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: 'Compradores' } })
    fireEvent.change(screen.getByLabelText(/^Fundamento/), { target: { value: 'consentimento' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Acrescentar tarefa' }))
    fireEvent.change(screen.getByLabelText('Nome da tarefa'), { target: { value: 'Ligar ao cliente' } })
    fireEvent.change(screen.getByLabelText('Prazo (dias depois do início)'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Repetir de N em N dias'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'POST')).toBe(true))
    expect(pedidos.find((p) => p.metodo === 'POST')!.corpo).toMatchObject({
      nome: 'Compradores',
      fundamento: 'consentimento',
      gatilhos: [],
      criterios: { concelhos: [] },
      passos: [{ nome: 'Ligar ao cliente', dias: 2, periodicidade_dias: 90, responsavel: null }],
    })
  })

  it('iniciar para o público mostra a pré-visualização com o RGPD e pede confirmação', async () => {
    const pedidos = simularApi({
      '/api/auth/eu/': () => json(ADMIN),
      'GET /api/marketing-entidades/inscricoes/': () => json({ count: 0, results: [] }),
      'GET /api/marketing-entidades/planos/': () =>
        json([
          {
            id: 1,
            nome: 'Compradores',
            descricao: '',
            objetivo: '',
            fundamento: 'consentimento',
            criterios: {},
            criterios_nomes: {},
            gatilhos: [],
            ativo: true,
            ordem: 0,
            passos: [],
            criado_em: '2026-11-27T10:00:00Z',
          },
        ]),
      '/api/marketing-entidades/planos/1/publico/': () =>
        json({ total: 10, oposicao: 2, sem_consentimento: 5, autorizadas: 3, ja_inscritas: 1, a_inscrever: 2 }),
      'POST /api/marketing-entidades/planos/1/iniciar-publico/': () => json({ inscritas: 2 }, 201),
    })
    desenhar('/marketing-entidades')
    fireEvent.click(await screen.findByRole('button', { name: 'Compradores' }))
    const dialogo = within(await screen.findByRole('dialog'))
    expect(await dialogo.findByText(/Excluídas por oposição a marketing: 2/)).toBeInTheDocument()
    expect(dialogo.getByText(/Excluídas por falta de consentimento: 5/)).toBeInTheDocument()
    fireEvent.click(dialogo.getByRole('button', { name: 'Confirmar e iniciar' }))
    expect(await dialogo.findByText(/Entraram no plano 2 entidades/)).toBeInTheDocument()
    expect(pedidos.filter((p) => p.metodo === 'POST')).toHaveLength(1)
  })
})
