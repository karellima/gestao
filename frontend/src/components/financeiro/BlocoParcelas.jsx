import { Calendar } from 'lucide-react';
import { formatCurrency } from '../../services/format';
import { parseCurrencyToNumber } from '../../services/masks';

export default function BlocoParcelas({ form, setForm, isCreditCard, frequencyOptions, installmentCount, installmentValue, startInstallment, installmentDates, effectiveDueDate }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1"><Calendar size={12} /> Parcelamento</p>
      <div className={`grid gap-3 ${installmentCount > 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Parcela Inicial</label>
          <input type="number" min="1" max={parseInt(form.installments) || 60} value={form.current_installment}
            onChange={e => setForm({...form, current_installment: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
          <p className="text-xs text-gray-400 mt-0.5">Nº desta parcela</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Total de Parcelas</label>
          <input type="number" min="1" max="60" value={form.installments}
            onChange={e => {
              const val = e.target.value;
              const newForm = {...form, installments: val};
              const defaultFreq = frequencyOptions.find(f => f.value === 'mensal')?.value || frequencyOptions[0]?.value || '';
              if (parseInt(val) <= 1) newForm.recurrence_frequency = '';
              else if (isCreditCard && !newForm.recurrence_frequency) newForm.recurrence_frequency = defaultFreq;
              setForm(newForm);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        {installmentCount > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Frequência *</label>
            <select value={form.recurrence_frequency} onChange={e => setForm({...form, recurrence_frequency: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Selecione...</option>
              {frequencyOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        )}
      </div>
      {installmentValue && (
        <div className="bg-white rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Valor total:</span><span className="font-medium">{formatCurrency(parseCurrencyToNumber(form.amount, 2))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Valor da parcela:</span><span className="font-bold text-brand-700">{formatCurrency(installmentValue)}</span></div>
          {form.recurrence_frequency && effectiveDueDate && (
            <div className="border-t pt-2 mt-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Cronograma (a partir do vencimento):</p>
              <div className="space-y-1 max-h-40 overflow-auto">
                {installmentDates.map((date, index) => {
                  const number = startInstallment + index;
                  return (
                    <div key={index} className={`flex justify-between text-xs px-2 py-1 rounded ${number === startInstallment ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600'}`}>
                      <span>{number}ª parcela{number === startInstallment ? ' (atual)' : ''}</span>
                      <span>{date.toLocaleDateString('pt-BR')}</span>
                      <span>{formatCurrency(installmentValue)}</span>
                    </div>
                  );
                })}
                {startInstallment + installmentDates.length - 1 < installmentCount && (
                  <p className="text-xs text-gray-400 text-center">... mais {installmentCount - startInstallment - installmentDates.length + 1} parcelas</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
