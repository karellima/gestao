const VALUE_EXTRACTORS = {
  financial_category_id: (t) => t.financial_category?.name || '',
  payment_type_id: (t) => t.payment_type?.name || '',
  account_id: (t) => t.account?.name || '',
  due_date: (t) => t.due_date || '',
};

function extractSortValue(transaction, key) {
  const extractor = VALUE_EXTRACTORS[key];
  return extractor ? extractor(transaction) : transaction[key];
}

function normalizeSortValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.toLowerCase();
  return value;
}

function compareNormalized(aVal, bVal, direction) {
  if (aVal < bVal) return direction === 'asc' ? -1 : 1;
  if (aVal > bVal) return direction === 'asc' ? 1 : -1;
  return 0;
}

export function compareTransactions(a, b, sortConfig) {
  const aVal = normalizeSortValue(extractSortValue(a, sortConfig.key));
  const bVal = normalizeSortValue(extractSortValue(b, sortConfig.key));
  return compareNormalized(aVal, bVal, sortConfig.direction);
}

export function sortTransactions(transactions, sortConfig) {
  return [...transactions].sort((a, b) => compareTransactions(a, b, sortConfig));
}
