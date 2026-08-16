export function normalizeSortValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.toLowerCase();
  return value;
}

export function compareSortValues(aVal, bVal, direction) {
  if (aVal < bVal) return direction === 'asc' ? -1 : 1;
  if (aVal > bVal) return direction === 'asc' ? 1 : -1;
  return 0;
}

export function compareItems(a, b, sortConfig, getValue = (item, key) => item[key]) {
  const aVal = normalizeSortValue(getValue(a, sortConfig.key));
  const bVal = normalizeSortValue(getValue(b, sortConfig.key));
  return compareSortValues(aVal, bVal, sortConfig.direction);
}

export function sortItems(items, sortConfig, getValue) {
  return [...items].sort((a, b) => compareItems(a, b, sortConfig, getValue));
}
