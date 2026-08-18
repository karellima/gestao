import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { Plus, Search, Upload } from 'lucide-react';
import ImportExcelModal from '../../components/ImportExcelModal';
import { formatNumberToCurrency, parseCurrencyToNumber } from '../../services/masks';
import { sortItems } from '../ordenacao';
import ProdutoForm from './ProdutoForm';
import TabelaDeProdutos from './TabelaDeProdutos';
import {
  applyCostChange, applyMarkupBlur, applyMarkupChange, applyPriceChange, formatDecimal,
} from './preco-derivado';
import { fromProduct, getEmptyForm, toPayload } from './produto-form';
import { confirmar } from '../../utils/confirmar';

const formDecimals = 2;

export default function Products() {
  const { notificar } = useNotificacao();
  const [products, setProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formError, setFormError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(getEmptyForm());
  const [lastEdited, setLastEdited] = useState('markup');

  const parentCategories = allCategories.filter(c => !c.parent_id);
  const subcategories = form.category_id
    ? allCategories.filter(c => c.parent_id === parseInt(form.category_id))
    : [];

  const loadProducts = useCallback(() => {
    const params = search ? { search } : {};
    api.get('/products/', { params }).then(res => setProducts(res.data)).catch(() => {});
  }, [search]);

  useEffect(() => {
    api.get('/categories/all').then(res => setAllCategories(res.data)).catch(() => {});
    api.get('/units/').then(res => setUnits(res.data)).catch(() => {});
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const sortedProducts = useMemo(
    () => sortItems(products, sortConfig),
    [products, sortConfig],
  );

  const handleSort = (key, direction) => setSortConfig({ key, direction });

  const handlePriceChange = (value) => {
    setForm(current => applyPriceChange(current, value, formDecimals));
    setLastEdited('price');
  };

  const handleMarkupChange = (value) => {
    setForm(current => applyMarkupChange(current, value, formDecimals));
    setLastEdited('markup');
  };

  const handleCostChange = (value) => {
    setForm(current => applyCostChange(current, value, lastEdited, formDecimals));
  };

  const handleMarkupBlur = () => {
    setForm(current => applyMarkupBlur(current));
  };

  const handleUnitChange = (value) => {
    setForm(current => ({
      ...current,
      unit_id: String(value),
      cost_price: current.cost_price ? formatNumberToCurrency(parseCurrencyToNumber(current.cost_price, formDecimals), 2) : '',
      price: current.price ? formatNumberToCurrency(parseCurrencyToNumber(current.price, formDecimals), 2) : '',
    }));
  };

  const resetForm = () => {
    setForm(getEmptyForm());
    setLastEdited('markup');
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const data = toPayload(form, formDecimals);
      if (editingProduct) await api.put(`/products/${editingProduct.id}`, data);
      else await api.post('/products/', data);
      setShowModal(false); setEditingProduct(null); resetForm(); loadProducts();
    } catch (err) { setFormError(err.response?.data?.detail || 'Erro ao salvar produto'); }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setForm(fromProduct(product, allCategories,
      value => formatNumberToCurrency(value, formDecimals), formatDecimal));
    setLastEdited('markup');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirmar('Remover este produto?')) return;
    try { await api.delete(`/products/${id}`); loadProducts(); }
    catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao remover produto'); }
  };

  const getCategoryName = (product) => {
    if (!product.category) return '-';
    const parent = product.category.parent_id
      ? allCategories.find(c => c.id === product.category.parent_id)
      : null;
    if (parent) return `${parent.name} / ${product.category.name}`;
    return product.category.name;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700">
            <Upload size={18} /> Importar Excel
          </button>
          <button onClick={() => { resetForm(); setEditingProduct(null); setShowModal(true); }}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
            <Plus size={18} /> Novo Produto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input type="text" placeholder="Buscar produto..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="flex-1 outline-none text-sm" />
        </div>
      </div>

      <TabelaDeProdutos products={sortedProducts} sortConfig={sortConfig} onSort={handleSort}
        onEdit={handleEdit} onDelete={handleDelete} getCategoryName={getCategoryName} />
      <ImportExcelModal open={showImport} onClose={() => setShowImport(false)} onImported={loadProducts} />
      <ProdutoForm open={showModal} editingProduct={editingProduct} form={form} setForm={setForm}
        formError={formError} parentCategories={parentCategories} subcategories={subcategories} units={units}
        onSubmit={handleSubmit} onCancel={() => setShowModal(false)} onUnitChange={handleUnitChange}
        onCostChange={handleCostChange} onMarkupChange={handleMarkupChange} onMarkupBlur={handleMarkupBlur}
        onPriceChange={handlePriceChange} formatDecimal={formatDecimal} formDecimals={formDecimals} />
    </div>
  );
}
