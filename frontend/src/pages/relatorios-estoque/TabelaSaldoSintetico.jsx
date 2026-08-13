import { formatCurrency } from '../../services/format';

export default function TabelaSaldoSintetico({ balance, financialData, columns, depositName, periodStr }) {
  const totalBalance = balance.reduce((s, b) => s + b.balance, 0);
  const syntheticTotal = balance.reduce((s, b) => s + b.total_value_entries, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <p className="text-sm font-medium text-gray-700">Relatório de estoque - Saldo</p>
        <p className="text-xs text-gray-500">Depósito: {depositName} | Período: {periodStr}</p>
      </div>
      <table className="text-sm" style={{ width: 'auto' }}>
        <thead className="bg-gray-50">
          <tr>
            {columns.map(column => <th key={column.key} className={`${column.align === 'right' ? 'text-right' : 'text-left'} p-3 whitespace-nowrap`}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {balance.map(b => (
            <tr key={b.product_id} className="border-t hover:bg-gray-50">
              {columns.map(column => (
                <td key={column.key} className={`p-3 ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.key === 'product_name' ? 'font-medium' : ''} whitespace-nowrap`}>
                  {column.accessor(b)}
                </td>
              ))}
            </tr>
          ))}
          {financialData && balance.length > 0 && (
            <tr className="border-t-2 font-bold bg-gray-50">
              <td className="p-3 whitespace-nowrap">Total</td>
              <td className="p-3 text-right whitespace-nowrap">{totalBalance}</td>
              <td className="p-3 text-right whitespace-nowrap"></td>
              <td className="p-3 text-right whitespace-nowrap">{formatCurrency(syntheticTotal)}</td>
            </tr>
          )}
          {!financialData && balance.length > 0 && (
            <tr className="border-t-2 font-bold bg-gray-50">
              <td className="p-3 whitespace-nowrap">Total</td>
              <td className="p-3 text-right whitespace-nowrap">{totalBalance}</td>
            </tr>
          )}
          {balance.length === 0 && (
            <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">Nenhum dado encontrado</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
