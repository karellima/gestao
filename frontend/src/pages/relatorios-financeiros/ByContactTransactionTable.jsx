import { formatCurrency } from '../../services/format';
import TransactionTypeBadge from './TransactionTypeBadge';

export default function ByContactTransactionTable({ transactions, situationBadge }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="text-left p-3">Data Lançamento</th>
          <th className="text-left p-3">Data Vencimento</th>
          <th className="text-left p-3">Descrição</th>
          <th className="text-left p-3">Categoria</th>
          <th className="text-center p-3">Tipo</th>
          <th className="text-right p-3">Valor</th>
          <th className="text-center p-3">Situação</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(t => (
          <tr key={t.id} className="border-t hover:bg-gray-50">
            <td className="p-3 text-gray-600">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
            <td className="p-3 text-gray-600">{t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '-'}</td>
            <td className="p-3 text-gray-900">{t.description}</td>
            <td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td>
            <td className="p-3 text-center">
              <TransactionTypeBadge type={t.type} compact />
            </td>
            <td className={`p-3 text-right font-medium ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(t.amount)}
            </td>
            <td className="p-3 text-center">{situationBadge(t)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
