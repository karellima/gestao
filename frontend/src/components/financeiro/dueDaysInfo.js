const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

export function dueDaysInfo(transaction) {
  if (!transaction.due_date || ['pago', 'recebido'].includes(transaction.status)) return null;

  const due = new Date(transaction.due_date);
  due.setHours(12, 0, 0, 0);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.ceil((due - today) / DAY_IN_MILLISECONDS);

  if (diff < 0) {
    return { isOverdue: true, cls: 'text-red-700 bg-red-100', label: `${Math.abs(diff)}d atrasado` };
  }
  if (diff <= 3) {
    return { isOverdue: false, cls: 'text-orange-700 bg-orange-100', label: `${diff}d` };
  }
  return null;
}
