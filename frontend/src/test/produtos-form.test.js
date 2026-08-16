import { describe, expect, it } from 'vitest';
import {
  applyCostChange,
  applyMarkupBlur,
  applyMarkupChange,
  applyPriceChange,
} from '../pages/produtos/preco-derivado';

const form = { cost_price: '10,00', markup: '1,5000', price: '15,00' };

describe('derivação de preço dos produtos', () => {
  it('recalcula preço quando custo muda e markup foi editado', () => {
    expect(applyCostChange(form, '2000', 'markup').price).toBe('30,00');
  });

  it('recalcula markup quando custo muda e preço foi editado', () => {
    expect(applyCostChange(form, '2000', 'price').markup).toBe('0,7500');
  });

  it('recalcula markup no ramo de fallback quando markup editado está vazio', () => {
    const current = { ...form, markup: '', price: 'R$ 15,00' };
    expect(applyCostChange(current, '2000', 'markup').markup).toBe('0,7500');
  });

  it('não recalcula quando custo é zero ou vazio', () => {
    expect(applyCostChange(form, '', 'markup')).toEqual({ ...form, cost_price: '' });
    expect(applyCostChange(form, '0', 'price')).toEqual({ ...form, cost_price: '0,00' });
  });

  it('mantém markup vazio no blur', () => {
    expect(applyMarkupBlur({ ...form, markup: '' }).markup).toBe('');
  });

  it('mantém os recálculos dos campos editados', () => {
    expect(applyMarkupChange({ ...form, price: '' }, '2,0000').price).toBe('20,00');
    expect(applyPriceChange({ ...form, markup: '' }, '2000').markup).toBe('2,0000');
  });
});
