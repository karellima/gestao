import { CreditCard } from 'lucide-react';
import { currencyToDigits, formatDigitsToCurrency } from '../../services/masks';

const flagOptions = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Aura', 'Outro'];

export default function ContaCamposCartao({ form, setForm }) {
  return (
    <div className="border-t border-gray-100 pt-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={14} className="text-purple-500" />
        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Dados do Cartão</p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bandeira</label>
          <select value={form.flag} onChange={e => setForm({...form, flag: e.target.value})}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none">
            <option value="">Selecione a bandeira...</option>
            {flagOptions.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fechamento</label>
            <input type="number" min="1" max="31" placeholder="Dia" value={form.closing_day}
              onChange={e => setForm({...form, closing_day: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Vencimento</label>
            <input type="number" min="1" max="31" placeholder="Dia" value={form.due_day}
              onChange={e => setForm({...form, due_day: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Melhor Dia</label>
            <input type="number" min="1" max="31" placeholder="Dia" value={form.best_purchase_day}
              onChange={e => setForm({...form, best_purchase_day: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Limite Disponível (R$)</label>
          <input type="text" inputMode="decimal" placeholder="0,00" value={form.credit_limit}
            onChange={e => setForm({...form, credit_limit: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
        </div>
      </div>
    </div>
  );
}
