import { describe, expect, it } from 'vitest';
import { fromAccount, getEmptyForm, toPayload } from '../pages/contas/conta-form';

describe('toPayload de contas', () => {
  it('envia campos de cartão como null para conta bancária', () => {
    const payload = toPayload({
      ...getEmptyForm(), account_type: 'banco', balance: '10,00', flag: 'Visa',
      closing_day: '5', due_day: '10', best_purchase_day: '2', credit_limit: '100,00',
    });

    expect(payload).toMatchObject({
      account_type: 'banco', balance: 10, flag: null,
      closing_day: null, due_day: null, best_purchase_day: null, credit_limit: null,
    });
  });

  it('converte limite vazio para null e limite preenchido para número', () => {
    const empty = toPayload({ ...getEmptyForm(), account_type: 'cartao_credito', credit_limit: '' });
    const filled = toPayload({ ...getEmptyForm(), account_type: 'cartao_credito', credit_limit: '1.234,56' });

    expect(empty.credit_limit).toBe(null);
    expect(filled.credit_limit).toBe(1234.56);
  });

  it('converte dias de cartão para inteiros e vazios para null', () => {
    const payload = toPayload({
      ...getEmptyForm(), account_type: 'cartao_credito',
      closing_day: '10', due_day: '', best_purchase_day: '28',
    });

    expect(payload.closing_day).toBe(10);
    expect(payload.due_day).toBe(null);
    expect(payload.best_purchase_day).toBe(28);
  });
});

describe('fromAccount', () => {
  it('preserva zero no dia de fechamento', () => {
    expect(fromAccount({ account_type: 'cartao_credito', closing_day: 0 }).closing_day).toBe(0);
  });

  it('deixa saldo e limite nulos vazios', () => {
    const form = fromAccount({ account_type: 'banco', balance: null, credit_limit: null });

    expect(form.balance).toBe('');
    expect(form.credit_limit).toBe('');
  });
});
