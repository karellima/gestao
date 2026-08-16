import { getTodayLocal } from '../../services/format';
import { currencyToDigits, formatDigitsToCurrency } from '../../services/masks';
import { CaseInput } from '../CaseInput';

export default function CamposBasicos({ form, setForm, onDateChange, isCreditCard }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="financial-type" className="block text-xs font-medium text-gray-500 mb-1">Tipo *</label>
          <select id="financial-type" value={form.type} onChange={e => setForm({...form, type: e.target.value, financial_category_id: '', subcategory_id: ''})}
            className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </div>
        <div>
          <label htmlFor="financial-date" className="block text-xs font-medium text-gray-500 mb-1">Data Lançamento *</label>
          <input id="financial-date" type="date" value={form.date} onChange={e => onDateChange(e.target.value)}
            max={getTodayLocal()} className="w-full px-3 py-2 border rounded-lg text-sm" required />
          {isCreditCard && <p className="text-xs text-purple-500 mt-1">Data em que a compra foi realizada</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Descrição *</label>
        <CaseInput aria-label="Descrição" placeholder="Ex: Pagamento fornecedor, Venda produto..." value={form.description}
          onChange={e => setForm({...form, description: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg text-sm" required />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$) *</label>
        <input aria-label="Valor (R$)" type="text" inputMode="decimal" placeholder="0,00" value={form.amount}
          onChange={e => setForm({...form, amount: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
          className="w-full px-3 py-2 border rounded-lg text-sm" required />
      </div>
    </>
  );
}
