import { compareItems, sortItems } from '../ordenacao';

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

export function compareTransactions(a, b, sortConfig) {
  return compareItems(a, b, sortConfig, extractSortValue);
}

export function sortTransactions(transactions, sortConfig) {
  return sortItems(transactions, sortConfig, extractSortValue);
}
