import { Warehouse } from 'lucide-react';

export default function SelecaoDeDepositos({ deposits, depositIds, onToggle }) {
  if (deposits.length === 0) return null;

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Depósitos com Acesso</label>
      <p className="text-xs text-gray-400 mb-1">Apenas depósitos pai (filhos são liberados automaticamente)</p>
      <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-1">
        {deposits.filter(d => !d.parent_id).map(d => (
          <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
            <input type="checkbox" checked={depositIds.includes(d.id)}
              onChange={() => onToggle(d.id)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            <Warehouse size={14} className="text-gray-400" />
            {d.name}
          </label>
        ))}
      </div>
    </div>
  );
}
