import SearchableSelect from '../../components/SearchableSelect';
import { CaseInput } from '../../components/CaseInput';

export default function ProdutoCamposBasicos({ form, setForm, parentCategories, subcategories }) {
  return (
    <>
      <CaseInput placeholder="Nome do produto *" value={form.name}
        onChange={e => setForm({...form, name: e.target.value})}
        className="w-full px-3 py-2 border rounded-lg text-sm" required />
      <div className="grid grid-cols-2 gap-3">
        <CaseInput placeholder="SKU *" value={form.sku}
          onChange={e => setForm({...form, sku: e.target.value})}
          className="px-3 py-2 border rounded-lg text-sm" required />
        <CaseInput placeholder="Código de barras" value={form.barcode}
          onChange={e => setForm({...form, barcode: e.target.value})}
          className="px-3 py-2 border rounded-lg text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Categoria</label>
          <SearchableSelect options={parentCategories.map(c => ({ value: c.id, label: c.name }))}
            value={form.category_id ? parseInt(form.category_id) : ''}
            onChange={v => setForm({...form, category_id: String(v), subcategory_id: ''})}
            placeholder="Selecione..." />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Subcategoria</label>
          <SearchableSelect options={subcategories.map(c => ({ value: c.id, label: c.name }))}
            value={form.subcategory_id ? parseInt(form.subcategory_id) : ''}
            onChange={v => setForm({...form, subcategory_id: String(v)})}
            placeholder="Selecione..." disabled={!form.category_id} />
        </div>
      </div>
    </>
  );
}
