import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { desenhar, json, simularApi, UTILIZADOR_CONSULTOR } from '../../test/utilitarios'

const OPCOES = {
  papeis: [
    { id: 1, nome: 'Proprietário' },
    { id: 2, nome: 'Comprador' },
  ],
  origens: [],
  status: [
    { id: 30, nome: 'Ativo', categoria: 'ativo' },
    { id: 31, nome: 'Inativo', categoria: 'inativo' },
  ],
  estados_civis: [{ id: 40, nome: 'Casado(a)' }],
  regimes_casamento: [{ id: 41, nome: 'Separação de bens' }],
  zonas_comerciais: [],
  tipos_pessoa: [
    { valor: 'singular', nome: 'Pessoa singular' },
    { valor: 'coletiva', nome: 'Pessoa coletiva' },
  ],
  consentimentos: [{ valor: 'desconhecido', nome: 'Desconhecido / não recolhido' }],
  tipos_telefone: [{ valor: 'movel', nome: 'Telemóvel' }],
  tipos_relacao: [
    { id: 1, nome: 'Cônjuge', nome_inverso: 'Cônjuge', simetrica: true },
    { id: 4, nome: 'Gerente de', nome_inverso: 'Tem como gerente', simetrica: false },
  ],
  pode_criar: true,
  pode_transferir: false,
  pode_restaurar: false,
}

const ENTIDADE = {
  id: 7,
  referencia: 'ENT-000007',
  tipo_pessoa: 'singular',
  nome: 'Ana',
  apelido: 'Ensaio',
  nome_completo: 'Ana Ensaio',
  pais_fiscal: 'PT',
  nif: '123456789',
  data_nascimento: null,
  email: 'ana@exemplo.pt',
  telefones: [
    {
      id: 3,
      regiao: 'PT',
      numero: '912345678',
      numero_e164: '+351912345678',
      tipo: 'movel',
      principal: true,
      extensao: '',
    },
  ],
  rua: '',
  numero_policia: '',
  complemento: '',
  codigo_postal: '',
  localidade: '',
  freguesia: null,
  localizacao: null,
  papeis: [2],
  papeis_nomes: ['Comprador'],
  origem: null,
  origem_nome: null,
  responsavel: 1,
  responsavel_nome: 'Consultor Demo',
  status: 30,
  status_nome: 'Ativo',
  status_categoria: 'ativo',
  quem_recomendou: 9,
  quem_recomendou_dados: { id: 9, referencia: 'ENT-000009', nome: 'Rui Recomendador', acessivel: true },
  imovel_contacto: null,
  imovel_contacto_dados: null,
  visitou_imovel_contacto: false,
  motivo_nao_visitou: 'Já estava reservado',
  estado_civil: 40,
  regime_casamento: 41,
  nacionalidade: 'Portuguesa',
  documento_identificacao: '',
  naturalidade_freguesia: '',
  naturalidade_concelho: '',
  empresa: '',
  cargo: '',
  observacoes_pessoais: '',
  zona_comercial: null,
  nomes: { estado_civil: 'Casado(a)', regime_casamento: 'Separação de bens', zona_comercial: null },
  observacoes: '',
  consentimento_marketing: 'desconhecido',
  consentimento_marketing_em: null,
  oposicao_marketing: false,
  criado_em: '2026-11-14T10:00:00Z',
  atualizado_em: '2026-11-14T10:00:00Z',
  versao: 1,
  acoes: { editar: true, eliminar: true, transferir: false },
}

const base = {
  '/api/auth/eu/': () => json(UTILIZADOR_CONSULTOR),
  '/api/entidades/opcoes/': () => json(OPCOES),
  '/api/telefone/paises/': () => json([{ regiao: 'PT', indicativo: '+351' }]),
  '/api/localizacao/distritos/': () => json([]),
  'POST /api/entidades/duplicados/': () => json({ candidatos: [], outros: 0 }),
  'GET /api/entidades/7/relacoes/': () => json([]),
}

afterEach(() => vi.restoreAllMocks())

describe('Entidades', () => {
  it('lista e envia a pesquisa ao servidor', async () => {
    const pedidos = simularApi({
      ...base,
      'GET /api/entidades/': () =>
        json({
          count: 1,
          results: [
            {
              id: 7,
              referencia: 'ENT-000007',
              nome_completo: 'Ana Ensaio',
              tipo_pessoa: 'singular',
              nif: '123456789',
              email: 'ana@exemplo.pt',
              telefone_principal: '+351912345678',
              papeis_nomes: ['Comprador'],
              responsavel_nome: 'Consultor Demo',
              status_nome: 'Ativo',
              status_categoria: 'ativo',
            },
          ],
        }),
    })
    desenhar('/entidades')
    expect(await screen.findByText('Ana Ensaio')).toBeInTheDocument()
    expect(screen.getByText('+351 912 345 678')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pesquisar entidades'), { target: { value: 'ana' } })
    await waitFor(() =>
      expect(
        pedidos.some((p) => p.url.pathname === '/api/entidades/' && p.url.searchParams.get('pesquisa') === 'ana'),
      ).toBe(true),
    )
  })

  it('ficha abre em consulta com Editar e ações de contacto', async () => {
    simularApi({ ...base, 'GET /api/entidades/7/': () => json(ENTIDADE) })
    desenhar('/entidades/7')
    expect(await screen.findByRole('heading', { name: /Ana Ensaio/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/entidades/7/editar')
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/351912345678')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('erros do servidor abrem o bloco e mostram a mensagem no campo', async () => {
    simularApi({
      ...base,
      'POST /api/entidades/': () => json({ consentimento_marketing_em: ['Indique a data.'] }, 400),
    })
    desenhar('/entidades/nova')
    fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: 'Rui' } })
    // O bloco "Proteção de dados" começa recolhido.
    expect(screen.getByLabelText('Data do consentimento')).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Indique a data.')).toBeVisible()
    expect(screen.getByLabelText('Data do consentimento')).toBeVisible()
  })

  it('duplicado pede confirmação e reenvia com confirmar_duplicado', async () => {
    let tentativas = 0
    const pedidos = simularApi({
      ...base,
      'POST /api/entidades/': () => {
        tentativas += 1
        if (tentativas === 1)
          return json(
            {
              detail: 'Já existe',
              codigo: 'possivel_duplicado',
              candidatos: [{ ...ENTIDADE, responsavel_nome: 'Consultor Demo', motivos: ['nif'] }],
              outros: 0,
            },
            409,
          )
        return json(ENTIDADE, 201)
      },
      'GET /api/entidades/7/': () => json(ENTIDADE),
    })
    desenhar('/entidades/nova')
    fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const dialogo = await screen.findByRole('dialog', { hidden: true, name: 'Possível duplicado' })
    expect(within(dialogo).getByText(/responsável: Consultor Demo/)).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Gravar mesmo assim', hidden: true }))
    expect(await screen.findByRole('heading', { name: /Ana Ensaio/ })).toBeInTheDocument()
    const posts = pedidos.filter((p) => p.metodo === 'POST' && p.url.pathname === '/api/entidades/')
    expect((posts[1].corpo as { confirmar_duplicado: boolean }).confirmar_duplicado).toBe(true)
  })

  it('avisa antes de sair com alterações por guardar', async () => {
    simularApi({ ...base, 'GET /api/entidades/7/': () => json(ENTIDADE) })
    desenhar('/entidades/7/editar')
    fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: 'Ana Maria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText(/Tem alterações que ainda não foram guardadas/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem guardar', hidden: true }))
    expect(await screen.findByRole('link', { name: 'Editar' })).toBeInTheDocument()
  })

  it('edição envia a versão para controlo de concorrência e mostra conflito', async () => {
    const pedidos = simularApi({
      ...base,
      'GET /api/entidades/7/': () => json(ENTIDADE),
      'PATCH /api/entidades/7/': () =>
        json({ detail: 'Esta entidade foi alterada por outra pessoa entretanto.', codigo: 'conflito_versao' }, 409),
    })
    desenhar('/entidades/7/editar')
    fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: 'Ana Maria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/alterada por outra pessoa/)).toBeInTheDocument()
    const patch = pedidos.find((p) => p.metodo === 'PATCH')
    expect((patch?.corpo as { versao: number }).versao).toBe(1)
  })

  it('ficha mostra dados pessoais, status e quem recomendou', async () => {
    simularApi({
      ...base,
      'GET /api/entidades/7/': () => json(ENTIDADE),
      'GET /api/entidades/7/relacoes/': () => json([]),
    })
    desenhar('/entidades/7')
    expect(await screen.findByRole('link', { name: /Rui Recomendador/ })).toHaveAttribute('href', '/entidades/9')
    expect(screen.getByText('Separação de bens')).toBeInTheDocument()
    expect(screen.getByText('Já estava reservado')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Ativo/ })).toBeInTheDocument()
  })

  it('relações: mostra sem revelar entidades sem acesso e adiciona no sentido inverso', async () => {
    const pedidos = simularApi({
      ...base,
      'GET /api/entidades/7/': () => json(ENTIDADE),
      'GET /api/entidades/7/relacoes/': () =>
        json([{ id: 1, tipo: 1, rotulo: 'Cônjuge', acessivel: false, entidade: null, observacoes: '' }]),
      'GET /api/entidades/': () =>
        json({
          count: 1,
          results: [{ id: 9, referencia: 'ENT-000009', nome_completo: 'Empresa Ensaio, Lda.', nif: '' }],
        }),
      'POST /api/entidades/7/relacoes/': () =>
        json([
          {
            id: 2,
            tipo: 4,
            rotulo: 'Tem como gerente',
            acessivel: true,
            entidade: {
              id: 9,
              referencia: 'ENT-000009',
              nome_completo: 'Empresa Ensaio, Lda.',
              tipo_pessoa: 'singular',
              data_nascimento: '1980-03-15',
            },
            observacoes: '',
          },
        ]),
    })
    desenhar('/entidades/7')
    expect(await screen.findByText('Entidade a que não tem acesso')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar entidade relacionada' }))
    fireEvent.change(screen.getByLabelText('Esta entidade é…'), { target: { value: '4:inverso' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Entidade relacionada' }), { target: { value: 'empresa' } })
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Empresa Ensaio/ }))
    fireEvent.change(screen.getByLabelText('Data de aniversário'), { target: { value: '1980-03-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(await screen.findByRole('link', { name: /Empresa Ensaio/ })).toBeInTheDocument()
    expect(screen.getByText('Aniversário: 15 de março')).toBeInTheDocument()
    const post = pedidos.find((p) => p.metodo === 'POST' && p.url.pathname === '/api/entidades/7/relacoes/')
    expect(post?.corpo).toEqual({
      tipo: 4,
      sentido: 'inverso',
      entidade: 9,
      observacoes: '',
      data_nascimento: '1980-03-15',
    })
  })
})
