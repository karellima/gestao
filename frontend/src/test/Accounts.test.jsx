import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Accounts from '../pages/contas';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const account = {
  id: 1,
  name: 'Conta Principal',
  account_type: 'banco',
  balance: 1234.56,
  agency: '0001',
  account_number: '12345-6',
};

describe('Accounts page permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: [account] });
  });

  it('shows all write actions with accounts edit permission', async () => {
    useAuth.mockReturnValue({ permissions: { accounts: 'edit' } });

    render(<Accounts />);

    const card = await screen.findByRole('article', { name: 'Conta Conta Principal' });
    expect(screen.getByRole('button', { name: 'Nova Conta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Conta Principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir Conta Principal' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Conta Principal');
  });

  it('keeps account cards visible but hides write actions with view permission', async () => {
    useAuth.mockReturnValue({ permissions: { accounts: 'view' } });

    render(<Accounts />);

    const card = await screen.findByRole('article', { name: 'Conta Conta Principal' });
    expect(screen.queryByRole('button', { name: 'Nova Conta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Conta Principal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Conta Principal' })).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Conta Principal');
    expect(card).toHaveTextContent('Banco');
    expect(card).toHaveTextContent('Saldo');
    expect(card).toHaveTextContent('1.234,56');
  });

  it('hides write actions while permissions are still undefined', async () => {
    useAuth.mockReturnValue({ permissions: undefined });

    render(<Accounts />);

    await screen.findByRole('article', { name: 'Conta Conta Principal' });
    expect(screen.queryByRole('button', { name: 'Nova Conta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Conta Principal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Conta Principal' })).not.toBeInTheDocument();
  });
});
