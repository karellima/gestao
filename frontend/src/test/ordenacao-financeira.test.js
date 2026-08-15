import { describe, expect, it } from 'vitest';
import { compareTransactions, sortTransactions } from '../pages/financeiro/ordenacao';

const base = [
  {
    id: 1,
    description: 'Banana',
    financial_category: { name: 'Operacional' },
    payment_type: { name: 'Pix' },
    account: { name: 'Caixa' },
    due_date: '2026-03-10',
    amount: 10,
  },
  {
    id: 2,
    description: 'abacate',
    financial_category: { name: 'Administrativo' },
    payment_type: { name: 'Boleto' },
    account: { name: 'Banco' },
    due_date: '2026-02-01',
    amount: 20,
  },
  {
    id: 3,
    description: null,
    financial_category: null,
    payment_type: null,
    account: null,
    due_date: null,
    amount: 5,
  },
];

describe('compareTransactions / sortTransactions', () => {
  it('sorts special column financial_category_id by category name', () => {
    const sorted = sortTransactions(base, { key: 'financial_category_id', direction: 'asc' });
    expect(sorted.map(t => t.id)).toEqual([3, 2, 1]);
  });

  it('sorts special column payment_type_id by payment type name', () => {
    const sorted = sortTransactions(base, { key: 'payment_type_id', direction: 'asc' });
    expect(sorted.map(t => t.id)).toEqual([3, 2, 1]);
  });

  it('sorts special column account_id by account name', () => {
    const sorted = sortTransactions(base, { key: 'account_id', direction: 'asc' });
    expect(sorted.map(t => t.id)).toEqual([3, 2, 1]);
  });

  it('sorts special column due_date', () => {
    const sorted = sortTransactions(base, { key: 'due_date', direction: 'asc' });
    expect(sorted.map(t => t.id)).toEqual([3, 2, 1]);
  });

  it('treats null as empty string', () => {
    const result = compareTransactions(base[2], base[0], { key: 'description', direction: 'asc' });
    expect(result).toBe(-1);
  });

  it('compares strings case-insensitively', () => {
    const result = compareTransactions(base[1], base[0], { key: 'description', direction: 'asc' });
    expect(result).toBe(-1);
  });

  it('supports ascending and descending directions', () => {
    const asc = sortTransactions(base, { key: 'description', direction: 'asc' });
    const desc = sortTransactions(base, { key: 'description', direction: 'desc' });
    expect(asc.map(t => t.id)).toEqual([3, 2, 1]);
    expect(desc.map(t => t.id)).toEqual([1, 2, 3]);
  });
});
