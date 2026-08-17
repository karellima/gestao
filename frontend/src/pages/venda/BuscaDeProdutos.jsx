import { Plus } from 'lucide-react';

export default function BuscaDeProdutos({
  show,
  search,
  results,
  tablePrices,
  prodLabel,
  onOpen,
  onSearch,
  onAdd,
  onCancel,
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Produtos</h2>
        <button type="button" onClick={onOpen} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-green-700"><Plus size={16} /> Adicionar Produto</button>
      </div>

      {show && (
        <div className="mb-4 p-3 border border-brand-200 rounded-lg bg-brand-50">
          <input type="text" placeholder="Buscar produto..." value={search} onChange={e => onSearch(e.target.value)} autoFocus className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto border rounded-lg bg-white">
              {results.map(p => (
                <button key={p.id} type="button" onClick={() => onAdd(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-100 border-b flex items-center justify-between">
                  <span>{prodLabel(p)}</span>
                  <span className="text-gray-400 text-xs">{p.sku} - R$ {(tablePrices[p.id] ?? p.price)?.toFixed(2) || '0,00'}</span>
                </button>
              ))}
            </div>
          )}
          {search && results.length === 0 && <p className="text-xs text-gray-500">Nenhum produto encontrado</p>}
          <button type="button" onClick={onCancel} className="text-xs text-gray-500 mt-1">Cancelar</button>
        </div>
      )}
    </>
  );
}
