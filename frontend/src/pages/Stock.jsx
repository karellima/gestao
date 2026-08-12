import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import { formatCurrency, getTodayLocal } from '../services/format';
import { qtyStep, qtyMin, roundQty, currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';
import { ArrowDownCircle, ArrowUpCircle, Package, ClipboardList, Edit, Trash2 } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import SortableHeader from '../components/SortableHeader';
import { CaseInput, CaseTextarea } from '../components/CaseInput';

export default function Stock() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('entrada');
  const [sortConfig, setSortConfig] = useState({ key: 'movement_date', direction: 'desc' });
  const [form, setForm] = useState({
    product_id: '', deposit_id: '',     movement_date: getTodayLocal(),
    quantity: '', unit_price: '', reason: '', notes: '',
  });
  const qtyRef = useRef(null);

  useEffect(() => {
    if (form.product_id && showModal) qtyRef.current?.focus();
  }, [form.product_id, showModal]);

  const loadMovements = () => {
    api.get('/stock/movements/')
      .then(res => setMovements(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
    api.get('/deposits/mine').then(res => setDeposits(res.data)).catch(() => {});
    loadMovements();
  }, []);

  const getProductName = useCallback((id) => {
    const p = products.find(p => p.id === id);
    if (!p) return '-';
    return p.display_name || (p.unit?.abbreviation ? `${p.name} ${p.unit.abbreviation}` : p.name);
  }, [products]);
  const getDepositName = useCallback((id) => deposits.find(d => d.id === id)?.name || '-', [deposits]);

  const sortedMovements = useMemo(() => {
    const arr = [...movements];
    arr.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === 'product_id') { aVal = getProductName(aVal); bVal = getProductName(bVal); }
      if (sortConfig.key === 'deposit_id') { aVal = getDepositName(aVal); bVal = getDepositName(bVal); }
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [movements, sortConfig, getProductName, getDepositName]);

  const handleSort = (key, direction) => setSortConfig({ key, direction });

  const resetForm = () => {
    setForm({ product_id: '', deposit_id: '',     movement_date: getTodayLocal(), quantity: '', unit_price: '', reason: '', notes: '' });
    setEditing(null);
  };

  const handleEdit = (m) => {
    setEditing(m);
    setActiveTab(m.movement_type);
    setForm({
      product_id: String(m.product_id),
      deposit_id: String(m.deposit_id),
      movement_date: m.movement_date ? m.movement_date.split('T')[0] : '',
      quantity: String(m.quantity),
      unit_price: m.unit_price ? formatNumberToCurrency(m.unit_price, 2) : '',
      reason: m.reason || '',
      notes: m.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    // O histórico é imutável: isto grava um estorno, não apaga a linha.
    if (!confirm('Estornar esta movimentação? O lançamento original continua no histórico e um estorno será registrado ao lado dele.')) return;
    try {
      await api.delete(`/stock/movements/${id}`);
      loadMovements();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao estornar movimentação');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        product_id: parseInt(form.product_id), deposit_id: parseInt(form.deposit_id),
        movement_type: activeTab, movement_date: form.movement_date,
        quantity: roundQty(form.quantity, selectedUnit) || qtyMin(selectedUnit),
        unit_price: activeTab === 'entrada' ? parseCurrencyToNumber(form.unit_price, 2) : 0,
        reason: activeTab === 'saida' ? form.reason : (form.reason || null),
        notes: form.notes || null,
      };
      if (editing) {
        await api.put(`/stock/movements/${editing.id}`, data);
      } else {
        await api.post('/stock/movements/', data);
      }
      setShowModal(false); resetForm(); loadMovements();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar movimentação');
    }
  };

  const productOptions = products.map(p => ({ value: p.id, label: getProductName(p.id) }));
  const depositOptions = deposits.map(d => ({ value: d.id, label: d.name }));
  const selectedProduct = products.find(p => p.id === parseInt(form.product_id));
  const selectedUnit = selectedProduct?.unit?.abbreviation || '';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Movimentação de Estoque</h1>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setActiveTab('entrada'); setShowModal(true); }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700">
            <Package size={18} /> Nova Entrada
          </button>
          <button onClick={() => { resetForm(); setActiveTab('saida'); setShowModal(true); }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700">
            <ClipboardList size={18} /> Nova Requisição
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="text-sm" style={{ width: 'auto' }}>
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader label="Data" sortKey="movement_date" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Depósito" sortKey="deposit_id" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Produto" sortKey="product_id" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Tipo" sortKey="movement_type" currentSort={sortConfig} onSort={handleSort} align="center" />
              <SortableHeader label="Qtd" sortKey="quantity" currentSort={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="Preço Unit." sortKey="unit_price" currentSort={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="Total" sortKey="total_value" currentSort={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="Motivo" sortKey="reason" currentSort={sortConfig} onSort={handleSort} />
              <th className="p-3 text-center whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedMovements.map(m => (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="p-3 text-gray-600 whitespace-nowrap">{m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-3 whitespace-nowrap">{m.deposit_name || getDepositName(m.deposit_id)}</td>
                <td className="p-3 font-medium whitespace-nowrap">{m.product_name || getProductName(m.product_id)}</td>
                <td className="p-3 text-center whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    m.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {m.movement_type === 'entrada' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                    {m.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </td>
                <td className="p-3 text-right font-medium whitespace-nowrap">{m.quantity}</td>
                <td className="p-3 text-right whitespace-nowrap">{m.movement_type === 'entrada' ? formatCurrency(m.unit_price || 0) : '-'}</td>
                <td className="p-3 text-right whitespace-nowrap">{m.movement_type === 'entrada' ? formatCurrency(m.total_value || 0) : '-'}</td>
                <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{m.source === 'requisicao' ? '-' : (m.reason || '-')}</td>
                <td className="p-3 text-center whitespace-nowrap">
                  {m.source !== 'requisicao' && (
                    <>
                      <button onClick={() => handleEdit(m)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:text-red-800" title="Estornar"><Trash2 size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {sortedMovements.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhuma movimentação registrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setActiveTab('entrada')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'entrada' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <span className="flex items-center justify-center gap-1"><Package size={14} /> Entrada</span>
              </button>
              <button type="button" onClick={() => setActiveTab('saida')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'saida' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <span className="flex items-center justify-center gap-1"><ClipboardList size={14} /> Requisição</span>
              </button>
            </div>
            <h2 className="text-lg font-bold mb-4">
              {editing ? 'Editar' : 'Nova'} {activeTab === 'entrada' ? 'Entrada de Estoque' : 'Requisição de Saída'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Depósito *</label>
                <SearchableSelect options={depositOptions} value={form.deposit_id ? parseInt(form.deposit_id) : ''}
                  onChange={v => setForm({...form, deposit_id: String(v)})} placeholder="Selecione o depósito" ariaLabel="Depósito" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Produto *</label>
                <SearchableSelect options={productOptions} value={form.product_id ? parseInt(form.product_id) : ''}
                  onChange={v => setForm({...form, product_id: String(v)})} placeholder="Selecione o produto" ariaLabel="Produto" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data *</label>
                <input type="date" value={form.movement_date} onChange={e => setForm({...form, movement_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stock-quantity" className="block text-xs text-gray-500 mb-1">Quantidade *</label>
                  <input id="stock-quantity" placeholder="0" type="number" min={qtyMin(selectedUnit)} step={qtyStep(selectedUnit)} value={form.quantity}
                    ref={qtyRef}
                    onChange={e => setForm({...form, quantity: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" required />
                </div>
                {activeTab === 'entrada' && (
                  <div>
                    <label htmlFor="stock-unit-price" className="block text-xs text-gray-500 mb-1">Preço Unitário</label>
                    <input id="stock-unit-price" placeholder="R$ 0,00" type="text" inputMode="decimal" value={form.unit_price}
                      onChange={e => setForm({...form, unit_price: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                )}
              </div>
              {activeTab === 'saida' ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Motivo / Destino *</label>
                  <CaseInput placeholder="Ex: Uso interno, Transferência, Cliente X" value={form.reason}
                    onChange={e => setForm({...form, reason: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" required />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Motivo</label>
                  <CaseInput placeholder="Ex: Compra, Devolução, Ajuste" value={form.reason}
                    onChange={e => setForm({...form, reason: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Observações</label>
                <CaseTextarea placeholder="Observações" value={form.notes} rows={2}
                  onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit" className={`px-4 py-2 text-white rounded-lg text-sm hover:opacity-90 ${activeTab === 'entrada' ? 'bg-green-600' : 'bg-orange-600'}`}>
                  {editing ? 'Salvar Alterações' : (activeTab === 'entrada' ? 'Registrar Entrada' : 'Registrar Requisição')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
