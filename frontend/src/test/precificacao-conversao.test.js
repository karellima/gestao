import { beforeEach, describe, expect, it } from 'vitest';
import { fromConfig, toPayload, maskInt, fmtMoney, fmtPct } from '../pages/precificacao/conversao';
import { loadBasePercents } from '../pages/precificacao/percentuais-salvos';

describe('fromConfig / toPayload round-trip', () => {
  it('converts 0.06 to "6" and back to 0.06', () => {
    const form = fromConfig({ avarias_pct: 0.06 });
    expect(form.avarias_pct).toBe('6');
    expect(toPayload(form).avarias_pct).toBe(0.06);
  });

  it('converts 0.065 (one decimal place) round-trip', () => {
    const form = fromConfig({ avarias_pct: 0.065 });
    expect(form.avarias_pct).toBe('6,5');
    expect(toPayload(form).avarias_pct).toBe(0.065);
  });

  it('avoids float noise for 0.07 (would be 7.000000000000001 with * 100)', () => {
    const form = fromConfig({ avarias_pct: 0.07 });
    expect(form.avarias_pct).toBe('7');
    expect(toPayload(form).avarias_pct).toBe(0.07);
  });
});

describe('fromConfig missing or null fields', () => {
  it('falls back to DEFAULTS when field is absent', () => {
    const form = fromConfig({});
    expect(form.avarias_pct).toBe('6');
    expect(form.frete_pct).toBe('5');
    expect(form.margem_alvo).toBe('20');
    expect(form.acquisition_price).toBe('');
    expect(form.lote).toBe(1);
  });

  it('falls back to DEFAULTS when field is null', () => {
    const form = fromConfig({ avarias_pct: null, acquisition_price: null, lote: null });
    expect(form.avarias_pct).toBe('6');
    expect(form.acquisition_price).toBe('');
    expect(form.lote).toBe(1);
  });

  it('does not throw when obj is null or undefined', () => {
    expect(() => fromConfig(null)).not.toThrow();
    expect(() => fromConfig(undefined)).not.toThrow();
    expect(fromConfig(null).avarias_pct).toBe('6');
  });
});

describe('toPayload', () => {
  it('turns empty lote into 1', () => {
    expect(toPayload({ lote: '', acquisition_price: '' }).lote).toBe(1);
    expect(toPayload({ lote: undefined, acquisition_price: '' }).lote).toBe(1);
  });

  it('parses lote with thousand separator', () => {
    expect(toPayload({ lote: '1.500', acquisition_price: '' }).lote).toBe(1500);
  });

  it('respects decimals=3 on acquisition_price', () => {
    const payload = toPayload({ acquisition_price: '1,250', lote: '1' }, 3);
    expect(payload.acquisition_price).toBeCloseTo(1.25, 5);
  });
});

describe('maskInt', () => {
  it('groups thousands', () => {
    expect(maskInt('1500')).toBe('1.500');
    expect(maskInt('1000000')).toBe('1.000.000');
  });

  it('returns empty string for empty input', () => {
    expect(maskInt('')).toBe('');
  });
});

describe('fmtMoney / fmtPct', () => {
  it('returns "-" for null and undefined', () => {
    expect(fmtMoney(null)).toBe('-');
    expect(fmtMoney(undefined)).toBe('-');
    expect(fmtPct(null)).toBe('-');
    expect(fmtPct(undefined)).toBe('-');
  });

  it('formats money and percent values', () => {
    expect(fmtMoney(10.5)).toMatch(/10/);
    expect(fmtPct(0.065)).toBe('6,50%');
  });
});

describe('loadBasePercents', () => {
  beforeEach(() => {
    localStorage.removeItem('pricing_base_percents_v1');
  });

  it('returns null for invalid JSON without throwing', () => {
    localStorage.setItem('pricing_base_percents_v1', '{not-json');
    expect(loadBasePercents()).toBeNull();
  });

  it('returns null when value is not an object', () => {
    localStorage.setItem('pricing_base_percents_v1', JSON.stringify(42));
    expect(loadBasePercents()).toBeNull();
    localStorage.setItem('pricing_base_percents_v1', JSON.stringify('texto'));
    expect(loadBasePercents()).toBeNull();
    localStorage.setItem('pricing_base_percents_v1', JSON.stringify(null));
    expect(loadBasePercents()).toBeNull();
  });

  it('returns null when key is missing', () => {
    expect(loadBasePercents()).toBeNull();
  });
});
