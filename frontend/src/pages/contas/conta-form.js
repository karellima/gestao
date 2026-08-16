import { parseCurrencyToNumber, formatNumberToCurrency } from '../../services/masks';

function parseDay(value) {
  return value ? parseInt(value) : null;
}

function parseAmount(value) {
  return value ? parseCurrencyToNumber(value, 2) : null;
}

function emptyCardFields() {
  return { flag: null, closing_day: null, due_day: null, best_purchase_day: null, credit_limit: null };
}

function cardFields(form) {
  if (form.account_type !== 'cartao_credito') return emptyCardFields();
  return {
    flag: form.flag || null,
    closing_day: parseDay(form.closing_day),
    due_day: parseDay(form.due_day),
    best_purchase_day: parseDay(form.best_purchase_day),
    credit_limit: parseAmount(form.credit_limit),
  };
}

function emptyValue(value) {
  return value || '';
}

function preserveZero(value) {
  return value ?? '';
}

function formattedAmount(value) {
  return value != null ? formatNumberToCurrency(value, 2) : '';
}

export function getEmptyForm() {
  return {
    name: '', account_type: 'banco', bank_name: '', agency: '', account_number: '', balance: '',
    flag: '', closing_day: '', due_day: '', best_purchase_day: '', credit_limit: '',
  };
}

export function toPayload(form) {
  return {
    ...form,
    balance: parseCurrencyToNumber(form.balance, 2),
    ...cardFields(form),
  };
}

export function fromAccount(account) {
  return {
    name: account.name,
    account_type: account.account_type,
    bank_name: emptyValue(account.bank_name),
    agency: emptyValue(account.agency),
    account_number: emptyValue(account.account_number),
    balance: formattedAmount(account.balance),
    flag: emptyValue(account.flag),
    closing_day: preserveZero(account.closing_day),
    due_day: preserveZero(account.due_day),
    best_purchase_day: preserveZero(account.best_purchase_day),
    credit_limit: formattedAmount(account.credit_limit),
  };
}
