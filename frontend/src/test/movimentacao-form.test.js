import { describe, expect, it } from 'vitest';
import { toPayload } from '../pages/estoque/movimentacao-form';

const form = {
  product_id: '12',
  deposit_id: '7',
  movement_date: '2026-08-16',
  quantity: '',
  unit_price: '',
  reason: '',
  notes: '',
};

describe('toPayload de movimentação', () => {
  it('usa o mínimo da unidade quando a quantidade está vazia ou é zero', () => {
    expect(toPayload({ ...form, quantity: '' }, { tipo: 'entrada', unidade: 'un' }).quantity).toBe(1);
    expect(toPayload({ ...form, quantity: 0 }, { tipo: 'entrada', unidade: 'un' }).quantity).toBe(1);
  });

  it('converte o preço na entrada e zera o preço na saída', () => {
    expect(toPayload({ ...form, unit_price: 'R$ 12,34' }, { tipo: 'entrada', unidade: 'un' }).unit_price).toBe(12.34);
    expect(toPayload({ ...form, unit_price: 'R$ 12,34' }, { tipo: 'saida', unidade: 'un' }).unit_price).toBe(0);
  });

  it('preserva motivo vazio na saída e normaliza para null na entrada', () => {
    expect(toPayload(form, { tipo: 'saida', unidade: 'un' }).reason).toBe('');
    expect(toPayload(form, { tipo: 'entrada', unidade: 'un' }).reason).toBeNull();
  });

  it('converte produto e depósito para inteiros', () => {
    const payload = toPayload(form, { tipo: 'entrada', unidade: 'un' });

    expect(payload.product_id).toBe(12);
    expect(payload.deposit_id).toBe(7);
  });

  it('converte observações vazias para null', () => {
    expect(toPayload(form, { tipo: 'entrada', unidade: 'un' }).notes).toBeNull();
  });
});
