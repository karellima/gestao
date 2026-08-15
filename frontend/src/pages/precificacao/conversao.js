import {
  currencyToDigits, parseCurrencyToNumber, formatNumberToCurrency, parsePercent,
} from '../../services/masks';
import { DEFAULTS, PERCENT_FIELDS } from './percentuais-salvos';

export const fmtMoney = (n) => n == null ? '-' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct = (n) => n == null ? '-' : (Number(n) * 100).toFixed(2).replace('.', ',') + '%';

export const maskInt = (raw) => {
  const digits = currencyToDigits(raw);
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};

export function toPayload(f, decimals = 2) {
  const p = { acquisition_price: parseCurrencyToNumber(f.acquisition_price, decimals), lote: parseFloat(String(f.lote || '').replace(/\./g, '')) || 1 };
  PERCENT_FIELDS.forEach(k => { p[k] = parsePercent(f[k]) / 100; });
  return p;
}

export function fromConfig(obj, decimals = 2) {
  const f = { ...DEFAULTS };
  PERCENT_FIELDS.forEach(k => {
    if (obj && obj[k] !== undefined && obj[k] !== null) f[k] = String(Math.round(obj[k] * 10000) / 100).replace('.', ',');
  });
  if (obj) {
    if (obj.acquisition_price !== undefined && obj.acquisition_price !== null) {
      f.acquisition_price = formatNumberToCurrency(obj.acquisition_price, decimals);
    }
    if (obj.lote !== undefined && obj.lote !== null) f.lote = maskInt(String(obj.lote));
  }
  return f;
}
