import { Repeat } from 'lucide-react';

export default function CelulaDescricao({ transaction, frequencyLabels }) {
  return (
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
  );
}
