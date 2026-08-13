import { formatCurrency } from '../../services/format';

function cellClass(column) {
  const emphasis = {
    product_name: 'font-medium',
    quantity_entries: 'text-green-600',
    quantity_exits: 'text-red-600',
    balance: 'font-bold',
  }[column.key] || '';
  const align = column.align === 'right' ? 'text-right' : 'text-left';
  return `p-3 ${align} ${emphasis} whitespace-nowrap`;
}

export default function TabelaSaldoDetalhado({ balance, financialData, columns }) {
  const totalEntries = balance.reduce((s, b) => s + b.quantity_entries, 0);
  const totalExits = balance.reduce((s, b) => s + b.quantity_exits, 0);
  const totalBalance = balance.reduce((s, b) => s + b.balance, 0);
  const totalValueIn = balance.reduce((s, b) => s + b.total_value_entries, 0);
  const totalValueOut = balance.reduce((s, b) => s + b.total_value_exits, 0);

  return (
    <>
      {financialData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Entradas</p>
            <p className="text-xl font-bold text-green-600">{totalEntries}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Saídas</p>
            <p className="text-xl font-bold text-red-600">{totalExits}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Saldo</p>
            <p className="text-xl font-bold text-brand-600">{totalBalance}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Valor Entradas</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalValueIn)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Valor Saídas</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalValueOut)}</p>
          </div>
        </div>
      )}

      {!financialData && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Entradas</p>
            <p className="text-xl font-bold text-green-600">{totalEntries}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Saídas</p>
            <p className="text-xl font-bold text-red-600">{totalExits}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500">Saldo</p>
            <p className="text-xl font-bold text-brand-600">{totalBalance}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="text-sm" style={{ width: 'auto' }}>
          <thead className="bg-gray-50">
            <tr>
              {columns.map(column => <th key={column.key} className={`${column.align === 'right' ? 'text-right' : 'text-left'} p-3 whitespace-nowrap`}>{column.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {balance.map(b => (
              <tr key={b.product_id} className="border-t hover:bg-gray-50">
                {columns.map(column => <td key={column.key} className={cellClass(column)}>{column.accessor(b)}</td>)}
              </tr>
            ))}
            {balance.length === 0 && (
              <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">Nenhum dado encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
