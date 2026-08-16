import { CaseTextarea } from '../../components/CaseInput';
import ProdutoCamposBasicos from './ProdutoCamposBasicos';
import ProdutoCampoUnidade from './ProdutoCampoUnidade';
import ProdutoCamposPreco from './ProdutoCamposPreco';

export default function ProdutoForm({
  open, editingProduct, form, setForm, formError, parentCategories, subcategories, units,
  onSubmit, onCancel, onUnitChange, onCostChange, onMarkupChange, onMarkupBlur, onPriceChange,
  formatDecimal, formDecimals,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{editingProduct ? 'Editar' : 'Novo'} Produto</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          {formError && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded-lg">{formError}</div>
          )}
          <ProdutoCamposBasicos form={form} setForm={setForm}
            parentCategories={parentCategories} subcategories={subcategories} />
          <ProdutoCampoUnidade form={form} units={units} onUnitChange={onUnitChange} />
          <ProdutoCamposPreco form={form} onCostChange={onCostChange} onMarkupChange={onMarkupChange}
            onMarkupBlur={onMarkupBlur} onPriceChange={onPriceChange} formatDecimal={formatDecimal}
            formDecimals={formDecimals} />
          <CaseTextarea placeholder="Descrição do produto" value={form.description} rows={4}
            onChange={e => setForm({...form, description: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit"
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
