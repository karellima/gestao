const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

export function getAtrasoInfo(transaction) {
  const due = transaction.due_date ? new Date(transaction.due_date.replace('T', ' ')) : null;
  const diff = due ? Math.floor((new Date() - due) / DAY_IN_MILLISECONDS) : 0;
  const label = diff > 0 ? `${diff}d atraso` : diff < 0 ? `em ${Math.abs(diff)}d` : 'hoje';

  return { diff, label };
}
