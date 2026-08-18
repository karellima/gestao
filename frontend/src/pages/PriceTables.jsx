import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { Plus, Edit, Trash2, Tag, Search } from 'lucide-react';
import { CaseInput } from '../components/CaseInput';
import {
  currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency,
} from '../services/masks';

export default function PriceTables() {
  const { notificar } = useNotificacao();
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [focusPriceId, setFocusPriceId] = useState(null);
  const priceRefs = useRef({});

  const load = () => api.get('/price-tables/').then(res => setTables(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  useEffect(() => {
    api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
  }, []);

  const prodLabel = (p) => p.unit?.abbreviation ? `${p.name} ${p.unit.abbreviation}` : p.name;

  const searchProducts = (q) => {
    setProductSearch(q);
    if (q.length < 1) { setProductResults([]); return; }
    const lower = q.toLowerCase();
    setProductResults(products.filter(p =>
      p.name.toLowerCase().includes(lower) || (p.sku && p.sku.toLowerCase().includes(lower))
    ).slice(0, 8));
  };

  const addProduct = (product) => {
    if (items.some(it => it.productId === product.id)) { setProductSearch(''); setProductResults([]); return; }
    const newId = product.id;
    setItems([...items, {
      productId: product.id,
      productName: prodLabel(product),
      price: formatNumberToCurrency(product.price || 0, 2),
    }]);
    setProductSearch('');
    setProductResults([]);
    setFocusPriceId(newId);
  };

  useEffect(() => {
    if (focusPriceId != null && priceRefs.current[focusPriceId]) {
      priceRefs.current[focusPriceId].focus();
      priceRefs.current[focusPriceId].select();
      setFocusPriceId(null);
    }
  }, [focusPriceId, items]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setItems([]);
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description || '' });
    setItems((t.items || []).map(it => ({
      productId: it.product_id,
      productName: it.product_name,
      price: formatNumberToCurrency(it.price, 2),
    })));
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || null,
      items: items.map(it => ({ product_id: it.productId, price: parseCurrencyToNumber(it.price, 2) })),
    };
    try {
      if (editing) { await api.put(`/price-tables/${editing.id}`, payload); }
      else { await api.post('/price-tables/', payload); }
      setShowModal(false); load();
    } catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao salvar tabela'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta tabela de preços?')) return;
    try { await api.delete(`/price-tables/${id}`); load(); }
    catch (err) { notificar.erro(err.response?.data?.detail || 'Erro'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tabelas de Preços</h1>
        <button onClick={openNew}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Nova Tabela
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map(t => (
          <div key={t.id} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <Tag size={20} className="text-brand-600" />
                <span className="font-semibold">{t.name}</span>
              </div>
            </div>
            {t.description && <p className="text-sm text-gray-500 mb-2">{t.description}</p>}
            <p className="text-xs text-gray-400 mb-3">{t.items?.length || 0} produto(s)</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => openEdit(t)} className="text-brand-600 hover:text-brand-800"><Edit size={16} /></button>
              <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {tables.length === 0 && (
          <p className="text-gray-500 text-sm col-span-full text-center py-8">Nenhuma tabela de preços cadastrada</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nova'} Tabela de Preços</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <CaseInput placeholder="Nome *" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="col-span-2 px-3 py-2 border rounded-lg text-sm" required />
                <CaseInput placeholder="Descrição (opcional)" value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="col-span-2 px-3 py-2 border rounded-lg text-sm" />
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Preços</h3>
                  <div className="relative w-64">
                    <Search size={14} className="absolute left-2 top-2 text-gray-400" />
                    <input type="text" placeholder="Buscar produto..." value={productSearch}
                      onChange={e => searchProducts(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 border rounded-lg text-sm" />
                  </div>
                </div>
                {productSearch && productResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border rounded-lg bg-white mb-2">
                    {productResults.map(p => (
                      <button key={p.id} type="button" onClick={() => addProduct(p)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50 border-b flex items-center justify-between">
                        <span>{prodLabel(p)}</span>
                        <span className="text-gray-400 text-xs">R$ {p.price?.toFixed(2) || '0,00'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Nenhum produto adicionado</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Produto</th>
                        <th className="text-right p-2 w-32">Preço (R$)</th>
                        <th className="text-center p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(it => (
                        <tr key={it.productId} className="border-t">
                          <td className="p-2">{it.productName}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">R$</span>
                              <input type="text" inputMode="decimal" placeholder="0,00" value={it.price}
                                ref={el => { priceRefs.current[it.productId] = el; }}
                                onChange={e => setItems(items.map(x => x.productId === it.productId ? { ...x, price: formatDigitsToCurrency(currencyToDigits(e.target.value), 2) } : x))}
                                className="w-24 px-2 py-1 border rounded text-sm text-right" />
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => setItems(items.filter(x => x.productId !== it.productId))}
                              className="text-red-500 hover:text-red-700"><Trash2 size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
