import { formatCurrency } from '../../services/format';

const statusConfig = {
  pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
  pago: { label: 'Pago', cls: 'bg-green-100 text-green-700' },
  recebido: { label: 'Recebido', cls: 'bg-brand-100 text-brand-700' },
};

export default function TransactionStatus({ transaction }) {
  const totalPaid = (transaction.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
  const config = transaction.status === 'pago_parcial'
    ? { label: `Parcial ${formatCurrency(totalPaid)}`, cls: 'bg-orange-100 text-orange-700' }
    : statusConfig[transaction.status || 'pendente'] || statusConfig.pendente;

  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.cls}`}>{config.label}</span>;
}
