import { describe, expect, it } from 'vitest';
import { getEmptyForm, toPayload } from '../pages/usuarios/usuario-form';

const form = {
  ...getEmptyForm('operador'),
  name: 'Maria',
  email: 'maria@example.com',
};

describe('formulário de usuário', () => {
  it('recusa senha e confirmação diferentes sem preparar envio', () => {
    const result = toPayload({ ...form, password: 'abc123', confirmPassword: 'diferente' });

    expect(result).toEqual({ ok: false, erro: 'Senha e confirmação não conferem' });
  });

  it('inclui a senha sempre na criação', () => {
    const result = toPayload({ ...form, password: 'abc123', confirmPassword: 'abc123' });

    expect(result.data.password).toBe('abc123');
  });

  it('não inclui senha vazia na edição', () => {
    const result = toPayload({ ...form, password: '', confirmPassword: '' }, true);

    expect(result.data).not.toHaveProperty('password');
  });

  it('inclui senha preenchida na edição', () => {
    const result = toPayload({ ...form, password: 'nova123', confirmPassword: 'nova123' }, true);

    expect(result.data.password).toBe('nova123');
  });

  it('mantém deposit_ids no payload, inclusive quando vazio', () => {
    const result = toPayload({ ...form, deposit_ids: [] });

    expect(result.data).toHaveProperty('deposit_ids', []);
  });

  it('nunca envia confirmPassword para a API', () => {
    const result = toPayload({ ...form, password: 'abc123', confirmPassword: 'abc123' });

    expect(result.data).not.toHaveProperty('confirmPassword');
  });
});
