import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TransactionTypeBadge from '../pages/relatorios-financeiros/TransactionTypeBadge';

describe('TransactionTypeBadge', () => {
  it('labels revenue and expense transactions', () => {
    const { rerender } = render(<TransactionTypeBadge type="receita" />);
    expect(screen.getByText('Receita')).toBeInTheDocument();

    rerender(<TransactionTypeBadge type="despesa" />);
    expect(screen.getByText('Despesa')).toBeInTheDocument();

    rerender(<TransactionTypeBadge type="receita" compact />);
    expect(screen.getByText('Receita')).toHaveClass('py-0.5');
  });
});
