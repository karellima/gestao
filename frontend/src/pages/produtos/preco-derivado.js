import {
  currencyToDigits,
  formatDigitsToCurrency,
  parseCurrencyToNumber,
  formatNumberToCurrency,
  maskDecimalInput,
  parseDecimal,
} from '../../services/masks';

export function formatDecimal(num) {
  if (num == null || isNaN(num)) return '';
  return Number(num).toFixed(4).replace('.', ',');
}

export function applyPriceChange(form, value, decimals = 2) {
  const next = { ...form, price: formatDigitsToCurrency(currencyToDigits(value), decimals) };
  const cost = parseCurrencyToNumber(next.cost_price, decimals);
  const price = parseCurrencyToNumber(next.price, decimals);
  if (cost > 0 && price > 0) next.markup = formatDecimal(price / cost);
  return next;
}

export function applyMarkupChange(form, value, decimals = 2) {
  const next = { ...form, markup: maskDecimalInput(value, 4) };
  const cost = parseCurrencyToNumber(next.cost_price, decimals);
  const markup = parseDecimal(next.markup);
  if (cost > 0 && markup > 0) next.price = formatNumberToCurrency(cost * markup, decimals);
  return next;
}

export function applyCostChange(form, value, lastEdited, decimals = 2) {
  const next = { ...form, cost_price: formatDigitsToCurrency(currencyToDigits(value), decimals) };
  const cost = parseCurrencyToNumber(next.cost_price, decimals);
  if (cost > 0) {
    const markup = parseDecimal(next.markup);
    const price = parseCurrencyToNumber(next.price, decimals);
    if (lastEdited === 'markup' && markup > 0) {
      next.price = formatNumberToCurrency(cost * markup, decimals);
    } else if (lastEdited === 'price' && price > 0) {
      next.markup = formatDecimal(price / cost);
    } else if (markup > 0) {
      next.price = formatNumberToCurrency(cost * markup, decimals);
    } else if (price > 0) {
      next.markup = formatDecimal(price / cost);
    }
  }
  return next;
}

export function applyMarkupBlur(form) {
  return { ...form, markup: form.markup ? formatDecimal(parseDecimal(form.markup)) : '' };
}
