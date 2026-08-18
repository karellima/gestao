const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

function parseDueDate(dueDate) {
  if (!dueDate) return null;

  const parsed = new Date(dueDate.replace('T', ' '));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function atNoon(date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

export function getDueDays(dueDate, now = new Date()) {
  const due = parseDueDate(dueDate);
  if (!due) return 0;

  const dueAtNoon = atNoon(due);
  const todayAtNoon = atNoon(now);
  return Math.ceil((dueAtNoon - todayAtNoon) / DAY_IN_MILLISECONDS);
}

export function getDueDaysInfo(transaction) {
  if (!transaction.due_date || ['pago', 'recebido'].includes(transaction.status)) return null;

  const diff = getDueDays(transaction.due_date);
  if (diff < 0) {
    return { diff, isOverdue: true, cls: 'text-red-700 bg-red-100', label: `${Math.abs(diff)}d atrasado` };
  }
  if (diff <= 3) {
    return { diff, isOverdue: false, cls: 'text-orange-700 bg-orange-100', label: `${diff}d` };
  }
  return null;
}

export function getAtrasoInfo(transaction) {
  const dueDays = getDueDays(transaction.due_date);
  const diff = dueDays === 0 ? 0 : -dueDays;
  const label = diff > 0 ? `${diff}d atraso` : diff < 0 ? `em ${Math.abs(diff)}d` : 'hoje';

  return { diff, label };
}
