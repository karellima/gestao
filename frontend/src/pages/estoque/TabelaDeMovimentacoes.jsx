import SortableHeader from '../../components/SortableHeader';
import LinhaDeMovimentacao from './LinhaDeMovimentacao';

export default function TabelaDeMovimentacoes({
  movements, sortConfig, onSort, getProductName, getDepositName, onEdit, onDelete,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="text-sm" style={{ width: 'auto' }}>
        <thead className="bg-gray-50">
          <tr>
            <SortableHeader label="Data" sortKey="movement_date" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Depósito" sortKey="deposit_id" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Produto" sortKey="product_id" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Tipo" sortKey="movement_type" currentSort={sortConfig} onSort={onSort} align="center" />
            <SortableHeader label="Qtd" sortKey="quantity" currentSort={sortConfig} onSort={onSort} align="right" />
            <SortableHeader label="Preço Unit." sortKey="unit_price" currentSort={sortConfig} onSort={onSort} align="right" />
            <SortableHeader label="Total" sortKey="total_value" currentSort={sortConfig} onSort={onSort} align="right" />
            <SortableHeader label="Motivo" sortKey="reason" currentSort={sortConfig} onSort={onSort} />
            <th className="p-3 text-center whitespace-nowrap">Ações</th>
          </tr>
        </thead>
        <tbody>
          {movements.map(movement => (
            <LinhaDeMovimentacao
              key={movement.id}
              movement={movement}
              getProductName={getProductName}
              getDepositName={getDepositName}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {movements.length === 0 && (
            <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhuma movimentação registrada</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
