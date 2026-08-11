import { AlertTriangle, Clock, Edit, Landmark, Repeat, Trash2 } from 'lucide-react';
import { formatCurrency } from '../services/format';
import SortableHeader from './SortableHeader';

function dueDaysInfo(transaction) {
  if (!transaction.due_date || ['pago', 'recebido'].includes(transaction.status)) return null;
  const due = new Date(transaction.due_date);
  due.setHours(12, 0, 0, 0);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) {
    return { isOverdue: true, cls: 'text-red-700 bg-red-100', label: `${Math.abs(diff)}d atrasado` };
  }
  if (diff <= 3) {
    return { isOverdue: false, cls: 'text-orange-700 bg-orange-100', label: `${diff}d` };
  }
  return null;
}

function TransactionStatus({ transaction }) {
  const totalPaid = (transaction.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
  const statusConfig = {
    pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
    pago_parcial: { label: `Parcial ${formatCurrency(totalPaid)}`, cls: 'bg-orange-100 text-orange-700' },
    pago: { label: 'Pago', cls: 'bg-green-100 text-green-700' },
    recebido: { label: 'Recebido', cls: 'bg-brand-100 text-brand-700' },
  };
  const config = statusConfig[transaction.status || 'pendente'] || statusConfig.pendente;
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.cls}`}>{config.label}</span>;
}

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
          {transactions.map(transaction => {
            const dueInfo = dueDaysInfo(transaction);
            const AccountIcon = transaction.account
              ? accountTypeIcons[transaction.account.account_type] || Landmark
              : null;
            const accountColor = transaction.account
              ? accountTypeColors[transaction.account.account_type] || 'text-gray-600'
              : '';
            return (
              <tr key={transaction.id} className="border-t hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-500">{new Date(transaction.date).toLocaleDateString('pt-BR')}</td>
                <td className="p-3 whitespace-nowrap">
                  {transaction.due_date ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{new Date(transaction.due_date).toLocaleDateString('pt-BR')}</span>
                      {dueInfo && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${dueInfo.cls}`}>
                          {dueInfo.isOverdue ? <AlertTriangle size={11} /> : <Clock size={11} />}
                          {dueInfo.label}
                        </span>
                      )}
                    </div>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="p-3">
                  <div className="font-medium">{transaction.description}</div>
                  {transaction.installments > 1 && (
                    <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                      {transaction.recurrence_frequency && <Repeat size={10} />}
                      <span className="font-medium">{transaction.current_installment}/{transaction.installments}x</span>
                      {transaction.recurrence_frequency && (
                        <span className="bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded">
                          {frequencyLabels[transaction.recurrence_frequency]}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3 text-gray-500">{transaction.contact?.name || '-'}</td>
                <td className="p-3 text-gray-500">{transaction.financial_category?.name || '-'}</td>
                <td className="p-3 text-gray-500">{transaction.payment_type?.name || '-'}</td>
                <td className="p-3 text-gray-500 text-xs">
                  {transaction.account ? (
                    <div className="flex items-center gap-1.5">
                      <AccountIcon size={14} className={accountColor} />
                      <span className="truncate max-w-[80px]">{transaction.account.name}</span>
                    </div>
                  ) : '-'}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {transaction.type === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                </td>
                <td className="p-3 text-center"><TransactionStatus transaction={transaction} /></td>
                <td className={`p-3 text-right font-medium whitespace-nowrap ${transaction.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(transaction.amount)}
                </td>
                <td className="p-3 text-center whitespace-nowrap">
                  {(transaction.status === 'pendente' || transaction.status === 'pago_parcial') && (
                    <button onClick={() => onPay(transaction)} className="text-green-600 hover:text-green-800 mr-2 text-xs font-medium" title="Registrar pagamento">
                      Baixar
                    </button>
                  )}
                  <button onClick={() => onEdit(transaction)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
                  <button onClick={() => onDelete(transaction.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
