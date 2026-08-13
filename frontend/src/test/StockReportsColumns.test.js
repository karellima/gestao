import { describe, expect, it } from 'vitest';
import { getAvgPrice } from '../pages/relatorios-estoque/colunas';

describe('stock report columns', () => {
  it('calculates the average entry price', () => {
    expect(getAvgPrice({ quantity_entries: 4, total_value_entries: 100 })).toBe(25);
  });

  it('returns zero when there are no entries', () => {
    expect(getAvgPrice({ quantity_entries: 0, total_value_entries: 100 })).toBe(0);
  });
});
