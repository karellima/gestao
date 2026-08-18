import { AlertTriangle, Clock } from 'lucide-react';
import { getDueDaysInfo } from '../../services/atraso';

export default function CelulaVencimento({ transaction }) {
  const dueInfo = getDueDaysInfo(transaction);

  return (
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
  );
}
