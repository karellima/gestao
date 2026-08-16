import SortableHeader from './SortableHeader';
import TransacaoLinha from './financeiro/TransacaoLinha';

export default function FinancialTransactionTable({
  transactions,
  sortConfig,
  onSort,
  frequencyLabels,
  accountTypeIcons,
  accountTypeColors,
  onPay,
  onEdit,
  onDelete,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <SortableHeader label="Lançamento" sortKey="date" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Vencimento" sortKey="due_date" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Descrição" sortKey="description" currentSort={sortConfig} onSort={onSort} />
            <th className="p-3 text-xs font-semibold text-gray-500 uppercase text-left">Contato</th>
            <SortableHeader label="Categoria" sortKey="financial_category_id" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Pagamento" sortKey="payment_type_id" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Conta" sortKey="account_id" currentSort={sortConfig} onSort={onSort} />
            <SortableHeader label="Tipo" sortKey="type" currentSort={sortConfig} onSort={onSort} align="center" />
            <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <SortableHeader label="Valor" sortKey="amount" currentSort={sortConfig} onSort={onSort} align="right" />
            <th className="text-center p-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => (
            <TransacaoLinha key={transaction.id} transaction={transaction} frequencyLabels={frequencyLabels}
              accountTypeIcons={accountTypeIcons} accountTypeColors={accountTypeColors}
              onPay={onPay} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
