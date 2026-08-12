import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FinancialTransactionTable from '../components/FinancialTransactionTable'

const tableProps = (overrides = {}) => ({
  transactions: [{
    id: 1,
    date: '2026-08-10T12:00:00Z',
    due_date: '2026-08-20T12:00:00Z',
    description: 'Compra de materiais',
    type: 'despesa',
    amount: 100,
    status: 'pago_parcial',
    payments: [{ amount: 40 }],
    installments: 3,
    current_installment: 2,
    recurrence_frequency: 'mensal',
    contact: { name: 'Fornecedor A' },
    financial_category: { name: 'Operacional' },
    payment_type: { name: 'Pix' },
    account: { name: 'Conta principal', account_type: 'conta_corrente' },
  }],
  sortConfig: { key: 'date', direction: 'desc' },
  onSort: vi.fn(),
  frequencyLabels: { mensal: 'Mensal' },
  accountTypeIcons: {},
  accountTypeColors: {},
  onPay: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  ...overrides,
})

describe('FinancialTransactionTable', () => {
  it('renders status, installments, due date and related entities', () => {
    render(<FinancialTransactionTable {...tableProps()} />)

    expect(screen.getByText('Compra de materiais')).toBeInTheDocument()
    expect(screen.getByText('Parcial R$ 40,00')).toBeInTheDocument()
    expect(screen.getByText('2/3x')).toBeInTheDocument()
    expect(screen.getByText('Mensal')).toBeInTheDocument()
    expect(screen.getByText('Fornecedor A')).toBeInTheDocument()
    expect(screen.getByText('Operacional')).toBeInTheDocument()
  })

  it('requests sorting and exposes payment, edit and delete actions', async () => {
    const user = userEvent.setup()
    const testProps = tableProps()
    render(<FinancialTransactionTable {...testProps} />)

    await user.click(screen.getByRole('columnheader', { name: /Descrição/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Baixar Compra de materiais' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Compra de materiais' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Compra de materiais' }))

    expect(testProps.onSort).toHaveBeenCalledWith('description', 'asc')
    expect(testProps.onPay).toHaveBeenCalledWith(testProps.transactions[0])
    expect(testProps.onEdit).toHaveBeenCalledWith(testProps.transactions[0])
    expect(testProps.onDelete).toHaveBeenCalledWith(1)
  })
})
