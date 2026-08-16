import { Calendar } from 'lucide-react';

function VencimentoCartao({ form, calculatedDueDate, selectedAccount }) {
  return calculatedDueDate && (
    <div className="text-xs text-purple-600">
      Vencimento calculado: <strong>{new Date(calculatedDueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
      <span className="text-purple-400 ml-1">(compra {form.date && new Date(form.date).getDate() > selectedAccount.closing_day ? 'após' : 'antes'} do fechamento)</span>
    </div>
  );
}

function PainelCartao({ form, selectedAccount, calculatedDueDate }) {
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 space-y-1">
      <div className="text-xs text-purple-700 flex items-center gap-2">
        <Calendar size={12} />
        <span>
          {selectedAccount ? (
            <>
              <strong>{selectedAccount.name}</strong>
              {selectedAccount.flag && ` (${selectedAccount.flag})`}
              {selectedAccount.closing_day && selectedAccount.due_day
                ? ` — fecha dia ${selectedAccount.closing_day} / vence dia ${selectedAccount.due_day}`
                : ''}
            </>
          ) : 'Selecione um cartão na Conta/Cartão para calcular o vencimento'}
        </span>
      </div>
      <VencimentoCartao form={form} calculatedDueDate={calculatedDueDate} selectedAccount={selectedAccount} />
      {!selectedAccount?.closing_day && selectedAccount && (
        <div className="text-xs text-amber-600">Configure fechamento e vencimento na tela de Contas</div>
      )}
    </div>
  );
}

export default function BlocoCartao({ form, setForm, isCreditCard, selectedAccount, calculatedDueDate }) {
  if (isCreditCard) return <PainelCartao form={form} selectedAccount={selectedAccount} calculatedDueDate={calculatedDueDate} />;

  return (
    <div>
      <label htmlFor="financial-due-date" className="block text-xs font-medium text-gray-500 mb-1">Data Vencimento</label>
      <input id="financial-due-date" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
        className="w-full px-3 py-2 border rounded-lg text-sm" />
      <p className="text-xs text-gray-400 mt-1">Data em que a parcela vence</p>
    </div>
  );
}
