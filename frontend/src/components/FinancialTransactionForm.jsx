import { Calendar } from 'lucide-react';
import { formatCurrency, getTodayLocal } from '../services/format';
import { currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber } from '../services/masks';
import SearchableSelect from './SearchableSelect';
import { CaseInput, CaseTextarea } from './CaseInput';

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
              <SearchableSelect options={categoryOptions} value={form.financial_category_id ? parseInt(form.financial_category_id) : ''}
                onChange={val => setForm({...form, financial_category_id: val ? String(val) : '', subcategory_id: ''})}
                placeholder="Selecione..." ariaLabel="Categoria" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subcategoria</label>
              <SearchableSelect options={subcategoryOptions} value={form.subcategory_id ? parseInt(form.subcategory_id) : ''}
                onChange={val => setForm({...form, subcategory_id: val ? String(val) : ''})}
                placeholder={form.financial_category_id ? 'Selecione...' : 'Selecione a categoria primeiro'}
                disabled={!form.financial_category_id} ariaLabel="Subcategoria" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Pagamento</label>
              <SearchableSelect options={paymentTypeOptions} value={form.payment_type_id ? parseInt(form.payment_type_id) : ''}
                onChange={val => setForm({...form, payment_type_id: val ? String(val) : '', installments: '1', current_installment: '1', recurrence_frequency: ''})}
                placeholder="Selecione..." ariaLabel="Tipo de Pagamento" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Conta / Cartão</label>
              <SearchableSelect options={accountOptions} value={form.account_id ? parseInt(form.account_id) : ''}
                onChange={onAccountChange} renderOption={renderAccountOption} renderSelected={renderAccountSelected}
                placeholder="Selecione..." ariaLabel="Conta / Cartão" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contato</label>
            <SearchableSelect options={contactOptions} value={form.contact_id ? parseInt(form.contact_id) : ''}
              onChange={val => setForm({...form, contact_id: val ? String(val) : ''})} placeholder="Selecione..." ariaLabel="Contato" />
          </div>

          {isCreditCard ? (
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
              {calculatedDueDate && (
                <div className="text-xs text-purple-600">
                  Vencimento calculado: <strong>{new Date(calculatedDueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                  <span className="text-purple-400 ml-1">(compra {form.date && new Date(form.date).getDate() > selectedAccount.closing_day ? 'após' : 'antes'} do fechamento)</span>
                </div>
              )}
              {!selectedAccount?.closing_day && selectedAccount && (
                <div className="text-xs text-amber-600">Configure fechamento e vencimento na tela de Contas</div>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="financial-due-date" className="block text-xs font-medium text-gray-500 mb-1">Data Vencimento</label>
              <input id="financial-due-date" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">Data em que a parcela vence</p>
            </div>
          )}

          {showInstallments && (
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
