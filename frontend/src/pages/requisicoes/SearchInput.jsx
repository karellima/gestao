import { useMemo, useState } from 'react';

export default function SearchInput({ products, onSelect, searchRef }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (q.length < 1) return [];
    const lq = q.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(lq) || (p.sku && p.sku.toLowerCase().includes(lq))).slice(0, 8);
  }, [q, products]);

  return (
    <div className="relative">
      <input ref={searchRef} type="text" placeholder="Buscar produto..." value={q} autoFocus
        onChange={e => setQ(e.target.value)}
        className="w-full px-3 py-2.5 border rounded-lg text-sm" />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg z-10 max-h-40 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} type="button" onClick={() => { onSelect(p); setQ(''); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 border-b last:border-0 flex justify-between">
              <span>{p.name}{p.unit?.abbreviation ? ` ${p.unit.abbreviation}` : ''}</span>
              <span className="text-gray-400 text-xs">{p.sku}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
