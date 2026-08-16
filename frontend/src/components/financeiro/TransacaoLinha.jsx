import { formatCurrency } from '../../services/format';
import CelulaAcoes from './CelulaAcoes';
import CelulaConta from './CelulaConta';
import CelulaDescricao from './CelulaDescricao';
import CelulaVencimento from './CelulaVencimento';
import TransactionStatus from './TransactionStatus';

export default function TransacaoLinha({ transaction, frequencyLabels, accountTypeIcons, accountTypeColors, onPay, onEdit, onDelete }) {
  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="p-3 whitespace-nowrap text-gray-500">{new Date(transaction.date).toLocaleDateString('pt-BR')}</td>
      <CelulaVencimento transaction={transaction} />
      <CelulaDescricao transaction={transaction} frequencyLabels={frequencyLabels} />
      <td className="p-3 text-gray-500">{transaction.contact?.name || '-'}</td>
      <td className="p-3 text-gray-500">{transaction.financial_category?.name || '-'}</td>
      <td className="p-3 text-gray-500">{transaction.payment_type?.name || '-'}</td>
      <CelulaConta transaction={transaction} accountTypeIcons={accountTypeIcons} accountTypeColors={accountTypeColors} />
      <td className="p-3 text-center">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {transaction.type === 'receita' ? 'Receita' : 'Despesa'}
        </span>
      </td>
      <td className="p-3 text-center"><TransactionStatus transaction={transaction} /></td>
      <td className={`p-3 text-right font-medium whitespace-nowrap ${transaction.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
        {formatCurrency(transaction.amount)}
      </td>
      <CelulaAcoes transaction={transaction} onPay={onPay} onEdit={onEdit} onDelete={onDelete} />
    </tr>
  );
}
