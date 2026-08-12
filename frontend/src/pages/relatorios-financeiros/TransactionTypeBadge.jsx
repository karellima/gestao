export default function TransactionTypeBadge({ type, compact = false }) {
  return (
    <span className={`px-2 ${compact ? 'py-0.5' : 'py-1'} rounded-full text-xs font-medium ${type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {type === 'receita' ? 'Receita' : 'Despesa'}
    </span>
  );
}
