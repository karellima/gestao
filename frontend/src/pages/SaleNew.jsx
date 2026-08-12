import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Plus, Trash2, Save, X } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { CaseTextarea } from '../components/CaseInput';
import { qtyStep, roundQty, currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';

export default function SaleNew() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [priceTables, setPriceTables] = useState([]);
  const [tablePrices, setTablePrices] = useState({});
  const [contactId, setContactId] = useState('');
  const [saleTypeId, setSaleTypeId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [focusQtyId, setFocusQtyId] = useState(null);
  const qtyRefs = useRef({});

  useEffect(() => {
    api.get('/contacts/').then(res => setContacts(res.data.filter(c => c.contact_type === 'cliente' || c.contact_type === 'both'))).catch(() => {});
    api.get('/sale-types/').then(res => setSaleTypes(res.data)).catch(() => {});
    api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
    api.get('/price-tables/').then(res => setPriceTables(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!contactId) { setTablePrices({}); return; }
    const contact = contacts.find(c => c.id === parseInt(contactId));
    if (!contact || !contact.price_table_id) { setTablePrices({}); return; }
    const table = priceTables.find(t => t.id === contact.price_table_id);
    if (!table) { setTablePrices({}); return; }
    const map = {};
    (table.items || []).forEach(it => { map[it.product_id] = it.price; });
    setTablePrices(map);
  }, [contactId, contacts, priceTables]);

  const total = items.reduce((sum, it) => sum + it.quantity * parseCurrencyToNumber(it.unitPrice, 2), 0);

  const prodLabel = (p) => p.unit?.abbreviation ? `${p.name} ${p.unit.abbreviation}` : p.name;

  const addItem = (product) => {
    const existing = items.find(it => it.productId === product.id);
    if (existing) {
      setItems(items.map(it => it.productId === product.id ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      setItems([...items, {
        productId: product.id,
        productName: prodLabel(product),
        sku: product.sku,
        quantity: 1,
        unitAbbr: product.unit?.abbreviation || '',
        unitPrice: formatNumberToCurrency((tablePrices[product.id] ?? product.price) || 0, 2),
      }]);
    }
    setShowProductSearch(false);
    setProductSearch('');
    setFocusQtyId(product.id);
  };

  useEffect(() => {
    if (focusQtyId != null && qtyRefs.current[focusQtyId]) {
      qtyRefs.current[focusQtyId].focus();
      qtyRefs.current[focusQtyId].select();
      setFocusQtyId(null);
    }
  }, [focusQtyId, items]);

  const removeItem = (productId) => setItems(items.filter(it => it.productId !== productId));

  const updateItem = (productId, field, value) => {
    setItems(items.map(it => it.productId === productId ? { ...it, [field]: value } : it));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contactId) { alert('Selecione um cliente'); return; }
    if (!saleTypeId) { alert('Selecione o tipo de lançamento'); return; }
    if (items.length === 0) { alert('Adicione pelo menos um produto'); return; }
    try {
      await api.post('/sales/', {
        contact_id: parseInt(contactId),
        sale_type_id: parseInt(saleTypeId),
        notes: notes || null,
        items: items.map(it => ({
          product_id: it.productId,
          quantity: roundQty(it.quantity, it.unitAbbr),
          unit_price: parseCurrencyToNumber(it.unitPrice, 2),
        })),
      });
      navigate('/sales');
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar lançamento');
    }
  };

  const contactOptions = contacts.map(c => ({ value: c.id, label: c.name }));
  const typeOptions = saleTypes.map(t => ({ value: t.id, label: t.name }));

  const searchProducts = (q) => {
    setProductSearch(q);
    if (q.length < 1) { setProductResults([]); return; }
    const lower = q.toLowerCase();
    setProductResults(products.filter(p =>
      p.name.toLowerCase().includes(lower) || (p.sku && p.sku.toLowerCase().includes(lower))
    ).slice(0, 10));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Novo Lançamento</h1>
        <button onClick={() => navigate('/sales')} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <SearchableSelect options={contactOptions} value={contactId ? parseInt(contactId) : ''}
                onChange={v => setContactId(String(v))} placeholder="Selecione o cliente..." ariaLabel="Cliente" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Lançamento</label>
              <SearchableSelect options={typeOptions} value={saleTypeId ? parseInt(saleTypeId) : ''}
                onChange={v => setSaleTypeId(String(v))} placeholder="Selecione o tipo..." ariaLabel="Tipo de Lançamento" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Produtos</h2>
            <button type="button" onClick={() => setShowProductSearch(true)}
              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-green-700">
              <Plus size={16} /> Adicionar Produto
            </button>
          </div>

          {showProductSearch && (
            <div className="mb-4 p-3 border border-brand-200 rounded-lg bg-brand-50">
              <input type="text" placeholder="Buscar produto por nome ou SKU..." value={productSearch}
                onChange={e => searchProducts(e.target.value)} autoFocus
                className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
              {productResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-lg bg-white">
                  {productResults.map(p => (
                    <button key={p.id} type="button" onClick={() => addItem(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-brand-100 border-b flex items-center justify-between">
                      <span>{prodLabel(p)}</span>
                      <span className="text-gray-400 text-xs">{p.sku} - R$ {(tablePrices[p.id] ?? p.price)?.toFixed(2) || '0,00'}</span>
                    </button>
                  ))}
                </div>
              )}
              {productSearch && productResults.length === 0 && (
                <p className="text-xs text-gray-500">Nenhum produto encontrado</p>
              )}
              <button type="button" onClick={() => { setShowProductSearch(false); setProductSearch(''); }}
                className="text-xs text-gray-500 mt-1 hover:text-gray-700">Cancelar</button>
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum produto adicionado</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Produto</th>
                  <th className="text-center p-2 w-20">Qtd</th>
                  <th className="text-right p-2 w-28">Valor Unit.</th>
                  <th className="text-right p-2 w-28">Total</th>
                  <th className="text-center p-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.productId} className="border-t">
                    <td className="p-2 font-medium">{it.productName}</td>
                    <td className="p-2">
                      <input type="number" min={qtyStep(it.unitAbbr)} step={qtyStep(it.unitAbbr)} value={it.quantity}
                        aria-label={`Quantidade de ${it.productName}`}
                        ref={el => { qtyRefs.current[it.productId] = el; }}
                        onChange={e => updateItem(it.productId, 'quantity', roundQty(e.target.value, it.unitAbbr))}
                        className="w-16 px-2 py-1 border rounded text-sm text-center" />
                    </td>
                    <td className="p-2">
                      <input type="text" inputMode="decimal" value={it.unitPrice}
                        aria-label={`Valor unitário de ${it.productName}`}
                        onChange={e => updateItem(it.productId, 'unitPrice', formatDigitsToCurrency(currencyToDigits(e.target.value), 2))}
                        className="w-24 px-2 py-1 border rounded text-sm text-right" />
                    </td>
                    <td className="p-2 text-right font-medium">R$ {(it.quantity * parseCurrencyToNumber(it.unitPrice, 2)).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => removeItem(it.productId)}
                        aria-label={`Remover ${it.productName}`}
                        className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={3} className="p-2 text-right">Total:</td>
                  <td className="p-2 text-right">R$ {total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <CaseTextarea placeholder="Observações (opcional)" value={notes} rows={3}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/sales')}
            className="px-6 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button type="submit"
            className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 flex items-center gap-2">
            <Save size={16} /> Salvar Lançamento
          </button>
        </div>
      </form>
    </div>
  );
}
