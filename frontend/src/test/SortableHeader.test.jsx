import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SortableHeader from '../components/SortableHeader'

describe('SortableHeader', () => {
  it('requests ascending sort when the user clicks an inactive column', async () => {
    const onSort = vi.fn()
    const user = userEvent.setup()

    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Descrição"
              sortKey="description"
              currentSort={{ key: 'date', direction: 'desc' }}
              onSort={onSort}
            />
          </tr>
        </thead>
      </table>,
    )

    await user.click(screen.getByRole('columnheader', { name: 'Descrição' }))

    expect(onSort).toHaveBeenCalledWith('description', 'asc')
  })
})
