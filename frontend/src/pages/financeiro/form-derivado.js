import { parseCurrencyToNumber } from '../../services/masks';
import { autoCalcDueDate, calcInstallmentDates } from './datas-financeiras';

export function isCreditPaymentType(paymentType) {
  const name = paymentType?.name?.toLowerCase() || '';
  return name.includes('cartão') || name.includes('cartao');
}

function toOption(item) {
  return { value: item.id, label: item.name };
}

function buildCategoryOptions(categories, form) {
  const filtered = categories.filter(c => c.type === form.type && !c.parent_id);
  const subs = categories.filter(c =>
    c.type === form.type && c.parent_id && String(c.parent_id) === String(form.financial_category_id)
  );
  return {
    categoryOptions: filtered.map(toOption),
    subcategoryOptions: subs.map(toOption),
  };
}

function buildInstallmentInfo(form, effectiveDueDate, showInstallments) {
  const installmentCount = parseInt(form.installments) || 1;
  const startInstallment = parseInt(form.current_installment) || 1;
  const installmentValue = form.amount && installmentCount > 1
    ? (parseCurrencyToNumber(form.amount, 2) / installmentCount)
    : null;
  const canCalc = form.recurrence_frequency && effectiveDueDate && installmentCount > 1;
  const installmentDates = canCalc
    ? calcInstallmentDates(effectiveDueDate, installmentCount, form.recurrence_frequency, startInstallment)
    : [];
  return { showInstallments, installmentCount, startInstallment, installmentValue, installmentDates };
}

function resolveDueDates(form, isCreditCard, selectedAccount) {
  const hasClosingDays = isCreditCard && selectedAccount?.closing_day && selectedAccount?.due_day;
  const calculatedDueDate = (hasClosingDays && form.date)
    ? autoCalcDueDate(form.date, selectedAccount.closing_day, selectedAccount.due_day)
    : null;
  return {
    calculatedDueDate,
    effectiveDueDate: calculatedDueDate || form.due_date,
  };
}

export function deriveFormState(form, { categories, accounts, paymentTypes, frequencies }) {
  const selectedPaymentType = paymentTypes.find(pt => String(pt.id) === String(form.payment_type_id));
  const selectedAccount = accounts.find(a => String(a.id) === String(form.account_id));
  const isCreditCard = isCreditPaymentType(selectedPaymentType)
    || selectedAccount?.account_type === 'cartao_credito';
  const { calculatedDueDate, effectiveDueDate } = resolveDueDates(form, isCreditCard, selectedAccount);
  const installment = buildInstallmentInfo(
    form,
    effectiveDueDate,
    selectedPaymentType?.requires_installments,
  );
  const { categoryOptions, subcategoryOptions } = buildCategoryOptions(categories, form);

  return {
    selectedPaymentType,
    selectedAccount,
    isCreditCard,
    calculatedDueDate,
    effectiveDueDate,
    ...installment,
    categoryOptions,
    subcategoryOptions,
    paymentTypeOptions: paymentTypes.filter(pt => pt.is_active).map(toOption),
    accountOptions: accounts.filter(a => a.is_active).map(a => ({ value: a.id, label: a.name, data: a })),
    frequencyOptions: frequencies.map(f => ({
      value: f.name.toLowerCase(),
      label: `${f.name} (${f.days_interval} dias)`,
    })),
    frequencyLabels: Object.fromEntries(frequencies.map(f => [f.name.toLowerCase(), f.name])),
  };
}

function dueDateForCreditAccount(acc, dateVal) {
  if (acc?.account_type !== 'cartao_credito') return '';
  if (!(acc.closing_day && acc.due_day && dateVal)) return undefined;
  return autoCalcDueDate(dateVal, acc.closing_day, acc.due_day);
}

export function applyAccountChange(form, accounts, accountId) {
  const acc = accounts.find(a => String(a.id) === String(accountId));
  const newForm = { ...form, account_id: accountId ? String(accountId) : '' };
  const due = dueDateForCreditAccount(acc, form.date);
  if (due !== undefined) newForm.due_date = due;
  return newForm;
}

export function applyDateChange(form, selectedAccount, dateVal) {
  const newForm = { ...form, date: dateVal };
  const due = dueDateForCreditAccount(selectedAccount, dateVal);
  if (due) newForm.due_date = due;
  return newForm;
}
