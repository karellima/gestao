import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Contacts from '../pages/contatos'

const testState = vi.hoisted(() => ({
  permissions: { contacts: 'edit' },
}))

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../services/api', () => ({ default: apiMock }))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ permissions: testState.permissions }),
}))
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ normalize: value => value }),
}))

const contact = {
  id: 1,
  name: 'Contato Teste',
  contact_type: 'cliente',
  segment: '',
  cpf_cnpj: '',
  email: '',
  phone: '',
  city: '',
  state: '',
}

const renderContacts = async permission => {
  testState.permissions = { contacts: permission }
  render(<Contacts />)
  await screen.findByText('Contato Teste')
}

const getContactCard = () => screen.getByText('Contato Teste').closest('.bg-white')

describe('permissões da tela de contatos', () => {
  beforeEach(() => {
    apiMock.get.mockImplementation(path => {
      if (path === '/contacts/') return Promise.resolve({ data: [contact] })
      return Promise.resolve({ data: [] })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('mostra os botões de escrita para contacts edit', async () => {
    await renderContacts('edit')

    expect(screen.getByRole('button', { name: 'Seguimentos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo Contato' })).toBeInTheDocument()
    expect(within(getContactCard()).getAllByRole('button')).toHaveLength(2)
  })

  it('não mostra nenhum botão de escrita para contacts view', async () => {
    await renderContacts('view')

    expect(screen.queryByRole('button', { name: 'Seguimentos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo Contato' })).not.toBeInTheDocument()
    expect(within(getContactCard()).queryAllByRole('button')).toHaveLength(0)
  })

  it('mantém a lista de contatos visível nos dois níveis de permissão', async () => {
    await renderContacts('edit')
    expect(screen.getByText('Contato Teste')).toBeInTheDocument()

    cleanup()
    await renderContacts('view')
    expect(screen.getByText('Contato Teste')).toBeInTheDocument()
  })
})
