export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function frequencyDays(freq) {
  return freq === 'semanal' ? 7 : freq === 'quinzenal' ? 15 : 0;
}

export function calcNextDueDate(baseDueDate, freq, step) {
  const d = new Date(baseDueDate);
  if (freq === 'mensal') return addMonths(d, step);
  return addDays(d, frequencyDays(freq) * step);
}

export function calcInstallmentDates(dueDate, total, freq, startInstallment) {
  if (!freq || total <= 1 || !dueDate) return [];
  const start = startInstallment || 1;
  return Array.from({ length: total - start + 1 }, (_, i) => calcNextDueDate(dueDate, freq, i));
}

export function autoCalcDueDate(transactionDate, closingDay, dueDay) {
  if (!closingDay || !dueDay) return transactionDate;
  const tx = new Date(transactionDate + 'T12:00:00');
  const txDay = tx.getDate();
  let dueMonth = tx.getMonth();
  let dueYear = tx.getFullYear();
  if (txDay > closingDay) dueMonth += 1;
  const due = new Date(dueYear, dueMonth, Math.min(dueDay, new Date(dueYear, dueMonth + 1, 0).getDate()));
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}
