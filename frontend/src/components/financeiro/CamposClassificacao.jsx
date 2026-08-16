import SearchableSelect from '../SearchableSelect';

export default function CamposClassificacao({ form, setForm, categoryOptions, subcategoryOptions, paymentTypeOptions, accountOptions, contactOptions, renderAccountOption, renderAccountSelected, onAccountChange }) {
  return (
    <>
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
    </>
  );
}
