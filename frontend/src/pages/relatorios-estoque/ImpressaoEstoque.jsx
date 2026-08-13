import PrintPreview from '../../components/PrintPreview';
import { getBalanceCols, getMovementCols, getSyntheticCols } from './colunas';

function PrintTable({ columns, rows }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-50">
          {columns.map(column => (
            <th key={column.key} className={`p-3 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.product_id || row.id || index} className="border-t">
            {columns.map(column => (
              <td key={column.key} className={`p-3 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}>
                {column.accessor(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ImpressaoEstoque({ activeTab, balance, movements, financialData, depositName, periodStr, onClose }) {
  const isMovement = activeTab === 'movements';
  const columns = activeTab === 'balance'
    ? getBalanceCols(financialData)
    : activeTab === 'synthetic'
    ? getSyntheticCols(financialData)
    : getMovementCols();
  const rows = isMovement ? movements : balance;
  const reportName = isMovement ? 'Movimentações de Estoque' : 'Relatório de Estoque - Saldo';

  return (
    <PrintPreview title={`${reportName}\nDepósito: ${depositName}\nPeríodo: ${periodStr}`} onClose={onClose} autoPrint>
      <PrintTable columns={columns} rows={rows} />
    </PrintPreview>
  );
}
