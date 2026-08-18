import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../services/api'
import { NotificacaoProvider } from '../contexts/NotificacaoContext'
import Financial from '../pages/Financial'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  configureApiErrorHandler: vi.fn(),
}))

vi.mock('../components/FinancialTransactionTable', () => ({
  default: ({ transactions, onSort, onPay, onEdit, onDelete }) => (
    <section aria-label="Transações">
      <button onClick={() => onSort('description', 'asc')}>Ordenar descrição</button>
      <ul>
        {transactions.map(transaction => (
          <li key={transaction.id}>
            <span>{transaction.description}</span>
            <button onClick={() => onEdit(transaction)}>Editar {transaction.description}</button>
            <button onClick={() => onPay(transaction)}>Baixar {transaction.description}</button>
            <button onClick={() => onDelete(transaction.id)}>Excluir {transaction.description}</button>
          </li>
        ))}
      </ul>
    </section>
  ),
}))

vi.mock('../components/FinancialTransactionForm', () => ({
  default: ({ editing, form, onSubmit, onClose }) => (
    <div role="dialog" aria-label="Formulário de transação">
      <h2>{editing ? 'Editar Transação' : 'Nova Transação'}</h2>
      <output>{form.description || 'sem descrição'}</output>
      <button onClick={event => onSubmit(event)}>Salvar transação</button>
      <button onClick={onClose}>Cancelar transação</button>
    </div>
  ),
}))

vi.mock('../components/FinancialPaymentModal', () => ({
  default: ({ onSubmit, onClose }) => (
    <div role="dialog" aria-label="Pagamento">
      <button onClick={event => onSubmit(event)}>Confirmar pagamento</button>
      <button onClick={onClose}>Cancelar pagamento</button>
    </div>
  ),
}))

const initialTransactions = [
  {
    id: 1, description: 'Zeladoria', amount: 100, type: 'despesa', date: '2026-08-10T12:00:00Z',
    financial_category_id: 1, status: 'pendente', payments: [],
  },
  {
    id: 2, description: 'Aluguel', amount: 200, type: 'despesa', date: '2026-08-09T12:00:00Z',
    financial_category_id: 1, status: 'pendente', payments: [],
  },
]

const lookupResponses = {
  '/financial-categories/all': [{ id: 1, name: 'Operacional', type: 'despesa', parent_id: null }],
  '/accounts/': [],
  '/payment-types/': [],
  '/contacts/': [],
  '/recurrence-frequencies/active': [],
}

describe('Financial page integration', () => {
  let transactions

  beforeEach(() => {
    transactions = initialTransactions.map(transaction => ({ ...transaction }))
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))

    api.get.mockImplementation(path => Promise.resolve({
      data: path === '/financial/transactions/' ? transactions : lookupResponses[path],
    }))
    api.post.mockImplementation(path => {
      if (path === '/financial/transactions/') {
        const created = { ...initialTransactions[0], id: 3, description: 'Novo lançamento' }
        transactions = [...transactions, created]
        return Promise.resolve({ data: created })
      }
      transactions = transactions.map(transaction =>
        transaction.id === 1 ? { ...transaction, status: 'pago', payments: [{ amount: 100 }] } : transaction,
      )
      return Promise.resolve({ data: {} })
    })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockImplementation(path => {
      const id = Number(path.split('/').pop())
      transactions = transactions.filter(transaction => transaction.id !== id)
      return Promise.resolve({ data: {} })
    })
  })

  it('creates, edits, pays, deletes and sorts transactions through the page boundary', async () => {
    const user = userEvent.setup()
    render(<NotificacaoProvider><Financial /></NotificacaoProvider>)

    const list = await screen.findByRole('list')
    expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'ZeladoriaEditar ZeladoriaBaixar ZeladoriaExcluir Zeladoria',
      'AluguelEditar AluguelBaixar AluguelExcluir Aluguel',
    ])

    await user.click(screen.getByRole('button', { name: 'Ordenar descrição' }))
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Aluguel')

    await user.click(screen.getByRole('button', { name: 'Nova Transação' }))
    expect(screen.getByRole('dialog', { name: 'Formulário de transação' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar transação' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/financial/transactions/', expect.any(Object)))
    await waitFor(() => expect(screen.getByText('Novo lançamento')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Editar Zeladoria' }))
    expect(screen.getByRole('status')).toHaveTextContent('Zeladoria')
    await user.click(screen.getByRole('button', { name: 'Salvar transação' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/financial/transactions/1', expect.any(Object)))

    await user.click(screen.getByRole('button', { name: 'Baixar Zeladoria' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/payments/', expect.any(Object)))

    await user.click(screen.getByRole('button', { name: 'Excluir Zeladoria' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/financial/transactions/1'))
    await waitFor(() => expect(screen.queryByText('Zeladoria')).not.toBeInTheDocument())
  })
})
