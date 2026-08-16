import { ArrowDownCircle, ArrowUpCircle, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../services/format';

const MOVEMENT_TYPES = {
  entrada: { color: 'bg-green-100 text-green-700', icon: ArrowDownCircle, label: 'Entrada' },
  saida: { color: 'bg-orange-100 text-orange-700', icon: ArrowUpCircle, label: 'Saída' },
};

function TipoDeMovimentacao({ movementType }) {
  const type = MOVEMENT_TYPES[movementType] || MOVEMENT_TYPES.saida;
  const Icon = type.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${type.color}`}>
      <Icon size={12} />
      {type.label}
    </span>
  );
}

function ValorDeEntrada({ movement, field }) {
  if (movement.movement_type !== 'entrada') return '-';
  return formatCurrency(movement[field] || 0);
}

function MotivoDaMovimentacao({ movement }) {
  return movement.source === 'requisicao' ? '-' : (movement.reason || '-');
}

function AcoesDaMovimentacao({ movement, onEdit, onDelete }) {
  if (movement.source === 'requisicao') return null;

  return (
    <>
      <button onClick={() => onEdit(movement)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
      <button onClick={() => onDelete(movement.id)} className="text-red-600 hover:text-red-800" title="Estornar"><Trash2 size={16} /></button>
    </>
  );
}

export default function LinhaDeMovimentacao({ movement, getProductName, getDepositName, onEdit, onDelete }) {
  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="p-3 text-gray-600 whitespace-nowrap">{movement.movement_date ? new Date(movement.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
      <td className="p-3 whitespace-nowrap">{movement.deposit_name || getDepositName(movement.deposit_id)}</td>
      <td className="p-3 font-medium whitespace-nowrap">{movement.product_name || getProductName(movement.product_id)}</td>
      <td className="p-3 text-center whitespace-nowrap">
        <TipoDeMovimentacao movementType={movement.movement_type} />
      </td>
      <td className="p-3 text-right font-medium whitespace-nowrap">{movement.quantity}</td>
      <td className="p-3 text-right whitespace-nowrap"><ValorDeEntrada movement={movement} field="unit_price" /></td>
      <td className="p-3 text-right whitespace-nowrap"><ValorDeEntrada movement={movement} field="total_value" /></td>
      <td className="p-3 text-gray-500 text-xs whitespace-nowrap"><MotivoDaMovimentacao movement={movement} /></td>
      <td className="p-3 text-center whitespace-nowrap">
        <AcoesDaMovimentacao movement={movement} onEdit={onEdit} onDelete={onDelete} />
      </td>
    </tr>
  );
}
