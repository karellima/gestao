import { CaseTextarea } from './CaseInput';
import BlocoCartao from './financeiro/BlocoCartao';
import BlocoParcelas from './financeiro/BlocoParcelas';
import CamposBasicos from './financeiro/CamposBasicos';
import CamposClassificacao from './financeiro/CamposClassificacao';

export default function FinancialTransactionForm({
  editing,
  form,
  setForm,
  onSubmit,
  onClose,
  categoryOptions,
  subcategoryOptions,
  paymentTypeOptions,
  accountOptions,
  contactOptions,
  renderAccountOption,
  renderAccountSelected,
  onAccountChange,
  onDateChange,
  isCreditCard,
  selectedAccount,
  calculatedDueDate,
  showInstallments,
  frequencyOptions,
  installmentCount,
  installmentValue,
  startInstallment,
  installmentDates,
  effectiveDueDate,
  submitError,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nova'} Transação</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <CamposBasicos form={form} setForm={setForm} onDateChange={onDateChange} isCreditCard={isCreditCard} />
          <CamposClassificacao form={form} setForm={setForm} categoryOptions={categoryOptions} subcategoryOptions={subcategoryOptions}
            paymentTypeOptions={paymentTypeOptions} accountOptions={accountOptions} contactOptions={contactOptions}
            renderAccountOption={renderAccountOption} renderAccountSelected={renderAccountSelected} onAccountChange={onAccountChange} />
          <BlocoCartao form={form} setForm={setForm} isCreditCard={isCreditCard} selectedAccount={selectedAccount} calculatedDueDate={calculatedDueDate} />
          {showInstallments && (
            <BlocoParcelas form={form} setForm={setForm} isCreditCard={isCreditCard} frequencyOptions={frequencyOptions}
              installmentCount={installmentCount} installmentValue={installmentValue} startInstallment={startInstallment}
              installmentDates={installmentDates} effectiveDueDate={effectiveDueDate} />
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
            <CaseTextarea placeholder="Notas adicionais..." value={form.notes} rows={2}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          {submitError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{submitError}</div>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
