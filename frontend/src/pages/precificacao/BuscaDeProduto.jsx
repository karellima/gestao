import { Package, X } from 'lucide-react';
import { fmtMoney } from './conversao';

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

export default function BuscaDeProduto({
  search,
  setSearch,
  showDropdown,
  setShowDropdown,
  selectedProductId,
  selected,
  filtered,
  onSelect,
  onClear,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="relative max-w-xl">
        <label className={labelCls}>Produto (opcional — para carregar/salvar os parâmetros de um produto)</label>
        <input
          placeholder="Buscar produto..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          className={`${inputCls} ${selectedProductId ? 'pr-8' : ''}`}
        />
        {selectedProductId && (
          <button
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600"
            title="Limpar seleção"
          >
            <X size={16} />
          </button>
        )}
        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-400">Nenhum produto encontrado</div>
            ) : filtered.map(p => (
              <button
                key={p.id}
                onMouseDown={() => onSelect(p)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-brand-50 ${String(p.id) === selectedProductId ? 'bg-brand-50' : ''}`}
              >
                <span>{p.display_name || p.name}</span>
                <span className="text-gray-400 text-xs">{p.price != null ? `R$ ${fmtMoney(p.price)}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <div className="mt-3 text-sm text-gray-500 flex gap-4 flex-wrap">
          <span className="flex items-center gap-1"><Package size={14} className="text-brand-500" /> {selected.display_name || selected.name}</span>
          {selected.cost_price != null && <span>Preço de custo: <b>R$ {fmtMoney(selected.cost_price)}</b></span>}
          {selected.price != null && <span>Preço atual: <b>R$ {fmtMoney(selected.price)}</b></span>}
        </div>
      )}
    </div>
  );
}
