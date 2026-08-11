import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FinancialPaymentModal from '../components/FinancialPaymentModal'

vi.mock('../components/CaseInput', () => ({
  CaseInput: props => <input {...props} />,
}))

describe('FinancialPaymentModal', () => {
  it('shows total and partial payment values and submits masked amount, date and interest', async () => {
    const user = userEvent.setup()
    const testProps = {
      transaction: {
        description: 'Compra de materiais',
        amount: 100,
        payments: [{ amount: 40 }],
      },
      form: { amount: '60,00', payment_date: '2026-08-10', interest: '', notes: '' },
      setForm: vi.fn(),
      onSubmit: vi.fn(event => event.preventDefault()),
      onClose: vi.fn(),
    }

    render(<FinancialPaymentModal {...testProps} />)

    expect(screen.getByText('Compra de materiais')).toBeInTheDocument()
    expect(screen.getByText(/Valor total: R\$ 100,00/)).toBeInTheDocument()
    expect(screen.getByText(/Já pago: R\$ 40,00/)).toBeInTheDocument()

    const amount = screen.getByDisplayValue('60,00')
    await user.clear(amount)
    await user.type(amount, '1250')
    await user.type(screen.getByPlaceholderText('0,00'), '199')
    await user.click(screen.getByRole('button', { name: 'Confirmar Pagamento' }))

    expect(testProps.setForm).toHaveBeenCalled()
    expect(testProps.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('closes without submitting when the user cancels', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <FinancialPaymentModal
        transaction={{ description: 'Mensalidade', amount: 50, payments: [] }}
        form={{ amount: '50,00', payment_date: '2026-08-10', interest: '', notes: '' }}
        setForm={vi.fn()}
        onSubmit={vi.fn()}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
