const STATUS_CLASSES = {
  pendente: 'bg-yellow-100 text-yellow-800',
  pago_parcial: 'bg-brand-100 text-brand-800',
  pago: 'bg-green-100 text-green-800',
  recebido: 'bg-green-100 text-green-800',
};

const STATUS_LABELS = {
  recebido: 'Recebido',
  pago: 'Pago',
  pago_parcial: 'Parcial',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status] || 'bg-gray-100'}`}>
      {STATUS_LABELS[status] || 'Pendente'}
    </span>
  );
}
