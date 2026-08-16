import { ClipboardList, Package } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';
import { CaseInput, CaseTextarea } from '../../components/CaseInput';
import { currencyToDigits, formatDigitsToCurrency, qtyMin, qtyStep } from '../../services/masks';

export default function MovimentacaoForm({
  editing, activeTab, form, setForm, depositOptions, productOptions, selectedUnit, qtyRef,
  onSubmit, onCancel, onTabChange,
}) {
  const isEntry = activeTab === 'entrada';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => onTabChange('entrada')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${isEntry ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <span className="flex items-center justify-center gap-1"><Package size={14} /> Entrada</span>
          </button>
          <button type="button" onClick={() => onTabChange('saida')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!isEntry ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <span className="flex items-center justify-center gap-1"><ClipboardList size={14} /> Requisição</span>
          </button>
        </div>
        <h2 className="text-lg font-bold mb-4">
          {editing ? 'Editar' : 'Nova'} {isEntry ? 'Entrada de Estoque' : 'Requisição de Saída'}
        </h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Depósito *</label>
            <SearchableSelect options={depositOptions} value={form.deposit_id ? parseInt(form.deposit_id, 10) : ''}
              onChange={v => setForm({...form, deposit_id: String(v)})} placeholder="Selecione o depósito" ariaLabel="Depósito" required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Produto *</label>
            <SearchableSelect options={productOptions} value={form.product_id ? parseInt(form.product_id, 10) : ''}
              onChange={v => setForm({...form, product_id: String(v)})} placeholder="Selecione o produto" ariaLabel="Produto" required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data *</label>
            <input type="date" value={form.movement_date} onChange={e => setForm({...form, movement_date: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="stock-quantity" className="block text-xs text-gray-500 mb-1">Quantidade *</label>
              <input id="stock-quantity" placeholder="0" type="number" min={qtyMin(selectedUnit)} step={qtyStep(selectedUnit)} value={form.quantity}
                ref={qtyRef}
                onChange={e => setForm({...form, quantity: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
            {isEntry && (
              <div>
                <label htmlFor="stock-unit-price" className="block text-xs text-gray-500 mb-1">Preço Unitário</label>
                <input id="stock-unit-price" placeholder="R$ 0,00" type="text" inputMode="decimal" value={form.unit_price}
                  onChange={e => setForm({...form, unit_price: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            )}
          </div>
          {activeTab === 'saida' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motivo / Destino *</label>
              <CaseInput placeholder="Ex: Uso interno, Transferência, Cliente X" value={form.reason}
                onChange={e => setForm({...form, reason: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motivo</label>
              <CaseInput placeholder="Ex: Compra, Devolução, Ajuste" value={form.reason}
                onChange={e => setForm({...form, reason: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Observações</label>
            <CaseTextarea placeholder="Observações" value={form.notes} rows={2}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            <button type="submit" className={`px-4 py-2 text-white rounded-lg text-sm hover:opacity-90 ${isEntry ? 'bg-green-600' : 'bg-orange-600'}`}>
              {editing ? 'Salvar Alterações' : (isEntry ? 'Registrar Entrada' : 'Registrar Requisição')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
