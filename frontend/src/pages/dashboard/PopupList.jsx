import { formatCurrency } from '../../services/format';
import { getAtrasoInfo } from './atraso';

export default function PopupList({ list, borderColor, label }) {
  return list && list.length > 0 && (
    <div className={`absolute z-50 left-0 top-full mt-0 bg-white border ${borderColor} rounded-xl shadow-lg p-3 hidden group-hover:block min-w-[300px]`}>
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</p>
      {list.slice(0, 5).map(t => {
        const { diff, label: dueLabel } = getAtrasoInfo(t);
        return (
          <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
            <div className="flex-1 min-w-0 mr-3">
              <p className="truncate font-medium text-gray-800">{t.contact || t.description}</p>
              <p className="text-xs text-gray-400">{t.contact && t.description !== t.contact ? t.description : ''}</p>
            </div>
            <div className="text-right whitespace-nowrap">
              <p className="font-semibold text-red-600">{formatCurrency(t.amount)}</p>
              <p className={`text-xs ${diff > 0 ? 'text-red-400' : 'text-gray-400'}`}>{dueLabel}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
