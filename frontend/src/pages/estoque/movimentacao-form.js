import { getTodayLocal } from '../../services/format';
import { qtyMin, roundQty, parseCurrencyToNumber } from '../../services/masks';

export function getEmptyForm() {
  return {
    product_id: '',
    deposit_id: '',
    movement_date: getTodayLocal(),
    quantity: '',
    unit_price: '',
    reason: '',
    notes: '',
  };
}

export function toPayload(form, { tipo, unidade }) {
  return {
    product_id: parseInt(form.product_id, 10),
    deposit_id: parseInt(form.deposit_id, 10),
    movement_type: tipo,
    movement_date: form.movement_date,
    quantity: roundQty(form.quantity, unidade) || qtyMin(unidade),
    unit_price: tipo === 'entrada' ? parseCurrencyToNumber(form.unit_price, 2) : 0,
    reason: tipo === 'saida' ? form.reason : (form.reason || null),
    notes: form.notes || null,
  };
}
