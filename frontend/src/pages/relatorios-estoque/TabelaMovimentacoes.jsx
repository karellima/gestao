import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

function cellClass(column) {
  const emphasis = {
    movement_date: 'text-gray-600',
    product_name: 'font-medium',
    quantity: 'font-medium',
    reason: 'text-gray-500 text-xs',
  }[column.key] || '';
  const align = column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left';
  return `p-3 ${align} ${emphasis} whitespace-nowrap`;
}

function movementTypeCell(movement) {
  const isEntry = movement.movement_type === 'entrada';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isEntry ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {isEntry ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
      {isEntry ? 'Entrada' : 'Saída'}
    </span>
  );
}

export default function TabelaMovimentacoes({ movements, columns }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="text-sm" style={{ width: 'auto' }}>
        <thead className="bg-gray-50">
          <tr>
            {columns.map(column => <th key={column.key} className={`${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'} p-3 whitespace-nowrap`}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {movements.map(m => (
            <tr key={m.id} className="border-t hover:bg-gray-50">
              {columns.map(column => (
                <td key={column.key} className={cellClass(column)}>
                  {column.key === 'movement_type' ? movementTypeCell(m) : column.accessor(m)}
                </td>
              ))}
            </tr>
          ))}
          {movements.length === 0 && (
            <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">Nenhuma movimentação encontrada</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
