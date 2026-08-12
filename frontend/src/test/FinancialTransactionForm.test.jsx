import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FinancialTransactionForm from '../components/FinancialTransactionForm'

vi.mock('../components/SearchableSelect', () => ({
  default: ({ options, value, onChange, placeholder, disabled, ariaLabel }) => (
    <select
      aria-label={ariaLabel || placeholder}
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}))

vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ normalize: value => value }),
}))

const form = {
  type: 'receita', date: '2026-08-10', description: '', amount: '',
  financial_category_id: '1', subcategory_id: '2', payment_type_id: '3',
  account_id: '', contact_id: '', due_date: '', installments: '1',
  current_installment: '1', recurrence_frequency: '', notes: '',
}

const props = (overrides = {}) => ({
  editing: null,
  form,
  setForm: vi.fn(),
  onSubmit: vi.fn(event => event.preventDefault()),
  onClose: vi.fn(),
  categoryOptions: [{ value: 1, label: 'Operacional' }],
  subcategoryOptions: [{ value: 2, label: 'Serviços' }],
  paymentTypeOptions: [{ value: 3, label: 'Pix' }],
  accountOptions: [{ value: 4, label: 'Conta corrente' }],
  contactOptions: [{ value: 5, label: 'Cliente' }],
  renderAccountOption: option => option.label,
  renderAccountSelected: option => option.label,
  onAccountChange: vi.fn(),
  onDateChange: vi.fn(),
  isCreditCard: false,
  selectedAccount: null,
  calculatedDueDate: '',
  showInstallments: false,
  frequencyOptions: [{ value: 'mensal', label: 'Mensal' }],
  installmentCount: 1,
  installmentValue: null,
  startInstallment: 1,
  installmentDates: [],
  effectiveDueDate: '',
  submitError: '',
  ...overrides,
})

describe('FinancialTransactionForm', () => {
  it('starts a new transaction and resets category fields when the type changes', async () => {
    const user = userEvent.setup()
    const testProps = props()

    render(<FinancialTransactionForm {...testProps} />)

    expect(screen.getByRole('heading', { name: 'Nova Transação' })).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo *' }), 'despesa')

    expect(testProps.setForm).toHaveBeenCalledWith({
      ...form,
      type: 'despesa',
      financial_category_id: '',
      subcategory_id: '',
    })
  })

  it('names the controls used by the complete financial flow', () => {
    render(<FinancialTransactionForm {...props()} />)

    expect(screen.getByRole('combobox', { name: 'Categoria' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Tipo de Pagamento' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Conta / Cartão' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Valor (R$)' })).toBeInTheDocument()
  })

  it('shows credit-card due date and installment controls while editing', async () => {
    const user = userEvent.setup()
    const testProps = props({
      editing: { id: 9 },
      isCreditCard: true,
      selectedAccount: { name: 'Visa empresarial', flag: 'Visa', closing_day: 10, due_day: 20 },
      calculatedDueDate: '2026-08-20',
      showInstallments: true,
      installmentCount: 3,
      installmentValue: 33.33,
      effectiveDueDate: '2026-08-20',
      installmentDates: [new Date('2026-08-20T12:00:00')],
      form: { ...form, installments: '3', recurrence_frequency: '' },
    })

    render(<FinancialTransactionForm {...testProps} />)

    expect(screen.getByRole('heading', { name: 'Editar Transação' })).toBeInTheDocument()
    expect(screen.getByText(/Visa empresarial/)).toBeInTheDocument()
    expect(screen.getByText(/Vencimento calculado/)).toBeInTheDocument()
    expect(screen.getByText('Parcelamento')).toBeInTheDocument()

    const frequency = within(screen.getByText('Frequência *').parentElement).getByRole('combobox')
    await user.selectOptions(frequency, 'mensal')
    expect(testProps.setForm).toHaveBeenCalledWith({ ...form, installments: '3', recurrence_frequency: 'mensal' })
  })

  it('exposes submit, cancel and validation error feedback', async () => {
    const user = userEvent.setup()
    const testProps = props({ submitError: 'Descrição obrigatória' })

    render(<FinancialTransactionForm {...testProps} />)

    expect(screen.getByText('Descrição obrigatória')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar' }).closest('form'))

    expect(testProps.onClose).toHaveBeenCalledTimes(1)
    expect(testProps.onSubmit).toHaveBeenCalledTimes(1)
  })
})
