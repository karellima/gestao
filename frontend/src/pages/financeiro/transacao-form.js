import { getTodayLocal } from '../../services/format';
import { parseCurrencyToNumber, formatNumberToCurrency } from '../../services/masks';

export function getEmptyForm() {
  return {
    type: 'receita', financial_category_id: '', subcategory_id: '', description: '', amount: '',
    date: getTodayLocal(), due_date: '', payment_type_id: '', account_id: '',
    contact_id: '', installments: '1', current_installment: '1', recurrence_frequency: '', notes: '',
  };
}

function toIntOrNull(value) {
  return value ? parseInt(value) : null;
}

function toIsoNoon(dateStr) {
  return new Date(dateStr + 'T12:00:00').toISOString();
}

function datePart(value) {
  return value?.split('T')[0] || '';
}

function installmentFields(form, showInstallments) {
  if (!showInstallments) return { installments: 1, current_installment: 1 };
  return {
    installments: parseInt(form.installments) || 1,
    current_installment: parseInt(form.current_installment) || 1,
  };
}

export function buildTransactionPayload(form, { effectiveDueDate, showInstallments }) {
  const catId = form.subcategory_id || form.financial_category_id;
  return {
    type: form.type,
    description: form.description,
    amount: parseCurrencyToNumber(form.amount, 2),
    date: toIsoNoon(form.date),
    due_date: effectiveDueDate ? toIsoNoon(effectiveDueDate) : null,
    financial_category_id: toIntOrNull(catId),
    payment_type_id: toIntOrNull(form.payment_type_id),
    account_id: toIntOrNull(form.account_id),
    contact_id: toIntOrNull(form.contact_id),
    ...installmentFields(form, showInstallments),
    recurrence_frequency: form.recurrence_frequency || null,
    notes: form.notes || null,
  };
}

function resolveCategoryFields(t, categories) {
  const cat = categories.find(c => c.id === t.financial_category_id);
  if (cat?.parent_id != null) {
    return {
      financial_category_id: String(cat.parent_id),
      subcategory_id: String(t.financial_category_id),
    };
  }
  return {
    financial_category_id: t.financial_category_id || '',
    subcategory_id: '',
  };
}

export function mapTransactionToForm(t, categories) {
  return {
    type: t.type,
    ...resolveCategoryFields(t, categories),
    description: t.description,
    amount: formatNumberToCurrency(t.amount, 2),
    date: datePart(t.date),
    due_date: datePart(t.due_date),
    payment_type_id: t.payment_type_id || '',
    account_id: t.account_id || '',
    contact_id: t.contact_id || '',
    installments: String(t.installments || 1),
    current_installment: String(t.current_installment || 1),
    recurrence_frequency: t.recurrence_frequency || '',
    notes: t.notes || '',
  };
}

export function formatSubmitError(err) {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg).join(', ');
  return detail || err.message;
}
