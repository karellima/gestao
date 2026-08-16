import { describe, expect, it } from 'vitest';
import { ALFABETO, TAMANHO, randPass } from '../pages/usuarios/senha';

describe('senha inicial', () => {
  it('tem o comprimento definido', () => {
    expect(randPass()).toHaveLength(TAMANHO);
  });

  it('usa apenas caracteres do alfabeto declarado', () => {
    const proibido = [...randPass()].filter(c => !ALFABETO.includes(c));
    expect(proibido).toEqual([]);
  });

  it('não repete a senha entre chamadas', () => {
    const senhas = new Set(Array.from({ length: 20 }, () => randPass()));
    expect(senhas.size).toBe(20);
  });
});
