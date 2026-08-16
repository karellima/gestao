import { Edit, Trash2 } from 'lucide-react';
import SortableHeader from '../../components/SortableHeader';

export default function TabelaDeProdutos({
  products, sortConfig, onSort, onEdit, onDelete, getCategoryName,
}) {
  const getProductName = (p) => p.display_name || (p.unit?.abbreviation ? `${p.name} ${p.unit.abbreviation}` : p.name);
  const fmtVal = (n) => n == null ? '-' : Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <SortableHeader label="Nome" sortKey="name" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="SKU" sortKey="sku" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Categoria" sortKey="category_id" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Preço Custo" sortKey="cost_price" currentSort={sortConfig} onSort={onSort} align="right" />
            <SortableHeader label="Markup" sortKey="markup" currentSort={sortConfig} onSort={onSort} align="right" />
            <SortableHeader label="Preço Venda" sortKey="price" currentSort={sortConfig} onSort={onSort} align="right" />
            <th className="text-center p-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-t hover:bg-gray-50">
              <td className="p-3 font-medium">{getProductName(p)}</td>
              <td className="p-3 text-gray-500">{p.sku}</td>
              <td className="p-3 text-gray-500 text-xs">{getCategoryName(p)}</td>
              <td className="p-3 text-right">{fmtVal(p.cost_price, p.unit)}</td>
              <td className="p-3 text-right">{p.markup != null ? Number(p.markup).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '-'}</td>
              <td className="p-3 text-right">{fmtVal(p.price, p.unit)}</td>
              <td className="p-3 text-center">
                <button aria-label={`Editar produto ${p.name}`} onClick={() => onEdit(p)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
                <button aria-label={`Excluir produto ${p.name}`} onClick={() => onDelete(p.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum produto cadastrado</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
