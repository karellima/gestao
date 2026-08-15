import { Edit, Trash2 } from 'lucide-react';
import { formatValue } from '../../services/masks';
import { unitDecimals } from '../../services/masks';
import { fmtMoney, fmtPct } from './conversao';

export default function TabelaPrecificacoes({ pricings, products, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm">Precificações Salvas</div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-3">Produto</th>
            <th className="text-right p-3">Aquisição</th>
            <th className="text-center p-3">Lote</th>
            <th className="text-center p-3">Margem Alvo</th>
            <th className="text-right p-3">Preço atual</th>
            <th className="text-center p-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pricings.map(p => (
            <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="p-3 font-medium">{p.display_name || p.product_name}</td>
              <td className="p-3 text-right">R$ {formatValue(p.acquisition_price, unitDecimals(products.find(x => String(x.id) === String(p.product_id))?.unit))}</td>
              <td className="p-3 text-center">{p.lote}</td>
              <td className="p-3 text-center">{fmtPct(p.margem_alvo)}</td>
              <td className="p-3 text-right">{p.price != null ? `R$ ${fmtMoney(p.price)}` : '-'}</td>
              <td className="p-3 text-center">
                <button onClick={() => onEdit(p)} className="text-brand-600 hover:text-brand-800 mr-2" title="Editar"><Edit size={16} /></button>
                <button onClick={() => onDelete(p.product_id)} className="text-red-600 hover:text-red-800" title="Remover"><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
          {pricings.length === 0 && (
            <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhuma precificação salva</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
