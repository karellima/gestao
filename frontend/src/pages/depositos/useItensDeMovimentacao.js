import { qtyMin, roundQty } from '../../services/masks';

export default function useItensDeMovimentacao({ items, balance, setItems, setSearchQ, searchRef }) {
  const balOf = (pid) => {
    const item = (balance || []).find(entry => entry.product_id === pid);
    return item ? item.balance : null;
  };

  const addItem = (product) => {
    if (items.find(item => item.product_id === product.product_id)) return;
    setItems(currentItems => [...currentItems, {
      product_id: product.product_id,
      product_name: product.product_name,
      quantity: 1,
      unit_abbr: product.unit_abbr || '',
    }]);
    setSearchQ('');
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const changeQty = (pid, delta) => setItems(currentItems => currentItems.map(item => {
    if (item.product_id !== pid) return item;
    const max = balOf(pid);
    const next = roundQty(item.quantity + delta, item.unit_abbr);
    return { ...item, quantity: Math.max(qtyMin(item.unit_abbr), max != null ? Math.min(next, max) : next) };
  }));

  const updateQty = (pid, value) => {
    if (value === '') return;
    const number = parseFloat(value);
    if (isNaN(number)) return;
    const max = balOf(pid);
    setItems(currentItems => currentItems.map(item => item.product_id === pid
      ? { ...item, quantity: Math.max(qtyMin(item.unit_abbr), max != null ? Math.min(number, max) : roundQty(number, item.unit_abbr)) }
      : item));
  };

  const removeItem = (pid) => setItems(currentItems => currentItems.filter(item => item.product_id !== pid));

  return { balOf, addItem, changeQty, updateQty, removeItem };
}
