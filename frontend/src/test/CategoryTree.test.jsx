import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CategoryTree from '../components/CategoryTree'

describe('CategoryTree', () => {
  it('sorts roots, expands children, and calls edit/delete actions at each level', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const categories = [
      { id: 1, name: 'Pai', parent_id: null, type: 'despesa' },
      { id: 2, name: 'Filho', parent_id: 1, type: 'despesa' },
    ]
    render(
      <CategoryTree
        rootCategories={[categories[0]]}
        allCategories={categories}
        expanded={{ 1: false }}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        showType
      />,
    )

    expect(screen.getByText('Pai')).toBeInTheDocument()
    expect(screen.queryByText('Filho')).not.toBeInTheDocument()
    const rootRow = screen.getByText('Pai').parentElement
    await user.click(within(rootRow).getAllByRole('button')[0])
    expect(onToggle).toHaveBeenCalledWith(1)

    // Re-render with the expanded state supplied by the page owner.
    const { container: expandedContainer } = render(
      <CategoryTree
        rootCategories={[categories[0]]}
        allCategories={categories}
        expanded={{ 1: true }}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        showType
      />,
    )
    expect(screen.getByText('Filho')).toBeInTheDocument()

    const rows = expandedContainer.querySelectorAll('div.flex.items-center')
    fireEvent.click(within(rows[0]).getAllByRole('button')[1])
    fireEvent.click(within(rows[0]).getAllByRole('button')[2])
    expect(onEdit).toHaveBeenCalledWith(categories[0])
    expect(onDelete).toHaveBeenCalledWith(1)
  })
})
