import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import NavigationSidebar from '../components/NavigationSidebar'

const renderSidebar = (props = {}) => render(
  <MemoryRouter>
    <NavigationSidebar
      user={{ name: 'Ana' }}
      permissions={{ financial: true, contacts: false }}
      isMobile={false}
      sidebarOpen
      setSidebarOpen={vi.fn()}
      onLogout={vi.fn()}
      {...props}
    />
  </MemoryRouter>,
)

describe('NavigationSidebar', () => {
  it('shows only permitted modules and expands/collapses sections', async () => {
    const user = userEvent.setup()
    renderSidebar()

    expect(screen.getByText('Lançamentos')).toBeInTheDocument()
    expect(screen.queryByText('Clientes/Fornecedores')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Financeiro' }))
    expect(screen.queryByRole('link', { name: 'Lançamentos' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Financeiro' }))
    expect(screen.getByRole('link', { name: 'Lançamentos' })).toHaveAttribute('href', '/financial')
  })

  it('closes a mobile sidebar and logs out through callbacks', async () => {
    const user = userEvent.setup()
    const setSidebarOpen = vi.fn()
    const onLogout = vi.fn()
    renderSidebar({ isMobile: true, sidebarOpen: true, setSidebarOpen, onLogout })

    await user.click(screen.getByTitle('Fechar menu'))
    await user.click(screen.getByRole('button', { name: /Sair/ }))

    expect(setSidebarOpen).toHaveBeenCalledWith(false)
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})
