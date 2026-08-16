import { Edit, Trash2 } from 'lucide-react';

export default function CelulaAcoes({ transaction, onPay, onEdit, onDelete }) {
  return (
    <td className="p-3 text-center whitespace-nowrap">
      {(transaction.status === 'pendente' || transaction.status === 'pago_parcial') && (
        <button aria-label={`Baixar ${transaction.description}`} onClick={() => onPay(transaction)} className="text-green-600 hover:text-green-800 mr-2 text-xs font-medium" title="Registrar pagamento">
          Baixar
        </button>
      )}
      <button aria-label={`Editar ${transaction.description}`} onClick={() => onEdit(transaction)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
      <button aria-label={`Excluir ${transaction.description}`} onClick={() => onDelete(transaction.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
    </td>
  );
}
