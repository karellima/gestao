import { parseCurrencyToNumber, parseDecimal } from '../../services/masks';

export function getEmptyForm() {
  return {
    name: '', sku: '', description: '', price: '', cost_price: '', markup: '',
    unit_id: '', category_id: '', subcategory_id: '', barcode: '', deposit_id: '',
  };
}

export function toPayload(form, decimals = 2) {
  return {
    name: form.name,
    sku: form.sku,
    description: form.description || null,
    barcode: form.barcode || null,
    price: form.price ? parseCurrencyToNumber(form.price, decimals) : null,
    cost_price: form.cost_price ? parseCurrencyToNumber(form.cost_price, decimals) : null,
    markup: form.markup ? parseDecimal(form.markup) : null,
    unit_id: form.unit_id ? parseInt(form.unit_id) : null,
    category_id: form.subcategory_id
      ? parseInt(form.subcategory_id)
      : (form.category_id ? parseInt(form.category_id) : null),
    deposit_id: form.deposit_id ? parseInt(form.deposit_id) : null,
  };
}

export function fromProduct(product, allCategories, formatCurrency, formatDecimal) {
  const category = getCategoryFields(product, allCategories);
  return {
    name: product.name,
    sku: product.sku,
    description: product.description || '',
    price: formatValue(product.price, formatCurrency),
    cost_price: formatValue(product.cost_price, formatCurrency),
    markup: formatValue(product.markup, formatDecimal),
    unit_id: product.unit_id || '',
    ...category,
    barcode: product.barcode || '',
    deposit_id: product.deposit_id || '',
  };
}

function getCategoryFields(product, allCategories) {
  const cat = allCategories.find(c => c.id === product.category_id);
  const parentCat = cat?.parent_id && allCategories.find(c => c.id === cat.parent_id);
  return {
    category_id: parentCat?.id || cat?.id || '',
    subcategory_id: cat?.parent_id ? cat.id : '',
  };
}

function formatValue(value, formatter) {
  return value != null ? formatter(value) : '';
}
