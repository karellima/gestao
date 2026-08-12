import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SearchableSelect from '../components/SearchableSelect'

describe('SearchableSelect', () => {
  it('opens by keyboard and selects an option through accessible roles', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <SearchableSelect
        options={[
          { value: 1, label: 'Arroz E2E un' },
          { value: 2, label: 'Feijão E2E un' },
        ]}
        value=""
        onChange={onChange}
        placeholder="Selecione o produto"
        ariaLabel="Produto"
        required
      />,
    )

    const combobox = screen.getByRole('combobox', { name: 'Produto' })
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(combobox).toHaveAttribute('aria-required', 'true')

    combobox.focus()
    await user.keyboard('{Enter}')

    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox')
    expect(combobox).toHaveAttribute('aria-controls', listbox.id)
    await user.click(within(listbox).getByRole('option', { name: 'Feijão E2E un' }))

    expect(onChange).toHaveBeenCalledWith(2)
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
  })
})
