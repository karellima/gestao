import { formatCurrency, getTodayLocal } from '../services/format';
import { currencyToDigits, formatDigitsToCurrency } from '../services/masks';
import { CaseInput } from './CaseInput';

export default function FinancialPaymentModal({ transaction, form, setForm, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">Registrar Pagamento</h2>
        <div className="mb-3 text-sm text-gray-600">
          <p><strong>{transaction.description}</strong></p>
          <p>Valor total: {formatCurrency(transaction.amount)}</p>
          {transaction.payments?.length > 0 && (
            <p>Já pago: {formatCurrency(transaction.payments.reduce((sum, payment) => sum + payment.amount, 0))}</p>
          )}
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Valor a pagar *</label>
            <input type="text" inputMode="decimal" min="0.01" value={form.amount}
              onChange={e => setForm({...form, amount: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data do pagamento *</label>
            <input type="date" value={form.payment_date}
              onChange={e => setForm({...form, payment_date: e.target.value})}
              max={getTodayLocal()} className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Juros / Multa</label>
            <input type="text" inputMode="decimal" placeholder="0,00" value={form.interest}
              onChange={e => setForm({...form, interest: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observação</label>
            <CaseInput type="text" placeholder="Nota opcional..." value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Confirmar Pagamento</button>
          </div>
        </form>
      </div>
    </div>
  );
}
