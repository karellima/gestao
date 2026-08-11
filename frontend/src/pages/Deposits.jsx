import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import { Plus, Edit, Trash2, Warehouse, ArrowRightLeft, AlertTriangle, BarChart3, Package, X, ClipboardCheck, ArrowDownCircle, ArrowUpCircle, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CaseInput, CaseTextarea } from '../components/CaseInput';
import { qtyStep, qtyMin, roundQty, currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';

const SIDES = {
  abastecimento: { label: 'Abastecimento', icon: ArrowRightLeft, color: 'text-brand-600', bg: 'bg-brand-50', btn: 'bg-brand-600 hover:bg-brand-700' },
  devolucao: { label: 'Devolução', icon: ArrowRightLeft, color: 'text-orange-600', bg: 'bg-orange-50', btn: 'bg-orange-600 hover:bg-orange-700' },
  avaria: { label: 'Avaria', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', btn: 'bg-red-600 hover:bg-red-700' },
};

const productLabel = (p) => p?.display_name || (p?.unit?.abbreviation ? `${p.name} ${p.unit.abbreviation}` : p?.name || '');

function TransferModal({ type, deposit, deposits, onClose, onDone }) {
  const side = SIDES[type];

  const srcId = type === 'abastecimento' ? deposit.parent_id : deposit.id;
  const dstId = type === 'abastecimento' ? deposit.id : deposit.parent_id;
  const srcName = (deposits.find(d => d.id === srcId) || {}).name || '?';
  const dstName = (deposits.find(d => d.id === dstId) || {}).name || '?';

  const [items, setItems] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [srcBalance, setSrcBalance] = useState(null);
  const [balanceError, setBalanceError] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;
    setSrcBalance(null);
    setBalanceError('');
    api.get('/stock/balance/', { params: { deposit_id: srcId } })
      .then(res => { if (active) setSrcBalance(res.data || []); })
      .catch(err => { if (active) setBalanceError(err.response?.data?.detail || 'Erro ao carregar o saldo do depósito'); });
    return () => { active = false; };
  }, [srcId]);

  const balOf = (pid) => {
    const b = (srcBalance || []).find(x => x.product_id === pid);
    return b ? b.balance : null;
  };

  const searchResults = useMemo(() => {
    if (searchQ.length < 1 || !srcBalance) return [];
    const lq = searchQ.toLowerCase();
    return srcBalance.filter(p => (p.product_name || '').toLowerCase().includes(lq)).slice(0, 8);
  }, [searchQ, srcBalance]);

  const addItem = (p) => {
    if (items.find(it => it.product_id === p.product_id)) return;
    setItems(i => [...i, { product_id: p.product_id, product_name: p.product_name, quantity: 1, unit_abbr: p.unit_abbr || '' }]);
    setSearchQ('');
    setTimeout(() => searchRef.current?.focus(), 50);
  };
  const changeQty = (pid, delta) => setItems(i => i.map(it => {
    if (it.product_id !== pid) return it;
    const max = balOf(pid);
    const next = roundQty(it.quantity + delta, it.unit_abbr);
    return { ...it, quantity: Math.max(qtyMin(it.unit_abbr), max != null ? Math.min(next, max) : next) };
  }));
  const updateQty = (pid, value) => {
    if (value === '') return;
    const n = parseFloat(value);
    if (isNaN(n)) return;
    const max = balOf(pid);
    setItems(i => i.map(it => it.product_id === pid ? { ...it, quantity: Math.max(qtyMin(it.unit_abbr), max != null ? Math.min(n, max) : roundQty(n, it.unit_abbr)) } : it));
  };
  const removeItem = (pid) => setItems(i => i.filter(it => it.product_id !== pid));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { alert('Adicione pelo menos um produto'); return; }
    for (const it of items) {
      const max = balOf(it.product_id);
      if (max != null && it.quantity > max) {
        alert(`${it.product_name}: quantidade (${it.quantity}) excede o saldo no depósito (${max})`);
        return;
      }
    }
    setLoading(true);
    try {
      await api.post('/stock/transfer', {
        source_deposit_id: srcId,
        destination_deposit_id: dstId,
        transfer_type: type,
        items: items.map(it => ({ product_id: it.product_id, quantity: roundQty(it.quantity, it.unit_abbr) })),
      });
      alert(`${side.label} realizado com sucesso!`);
      onDone();
    } catch (err) {
      alert(err.response?.data?.detail || `Erro ao realizar ${side.label.toLowerCase()}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-xl ${side.bg}`}><side.icon size={18} className={side.color} /></div>
            <h2 className="text-lg font-bold">{side.label}</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 bg-gray-50 border-b text-xs text-gray-500 flex items-center justify-between">
            <span>De: <strong className="text-gray-700">{srcName}</strong></span>
            <ArrowRightLeft size={14} className="text-gray-300" />
            <span>Para: <strong className="text-gray-700">{dstName}</strong></span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {balanceError && <p className="text-xs text-red-500">{balanceError}</p>}
            <div className="relative">
              <input ref={searchRef} type="text" placeholder="Buscar produto..." value={searchQ} autoFocus
                onChange={e => setSearchQ(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg text-sm" />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg z-10 max-h-40 overflow-y-auto">
                  {searchResults.map(p => (
                    <button key={p.product_id} type="button" onClick={() => addItem(p)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 border-b last:border-0 flex justify-between items-center">
                      <span className="flex-1">{p.product_name}</span>
                      <span className={`text-xs font-medium ${p.balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>Saldo: {p.balance}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!srcBalance && !balanceError && (
              <p className="text-sm text-gray-400 text-center py-6">Carregando produtos do depósito...</p>
            )}
            {srcBalance && srcBalance.length === 0 && !balanceError && (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum produto com saldo neste depósito</p>
            )}
            {srcBalance && searchQ && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">Nenhum produto encontrado neste depósito</p>
            )}
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Busque e adicione produtos acima</p>
            ) : (
              <div className="space-y-2">
                {items.map(it => {
                  const bal = balOf(it.product_id);
                  return (
                    <div key={it.product_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm font-medium truncate">{it.product_name}</div>
                        <div className="text-xs text-gray-500">
                          {type === 'abastecimento' ? 'Saldo no Pai' : 'Saldo'}: <span className={bal > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{bal != null ? bal : '—'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => changeQty(it.product_id, -1)}
                          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
                        <input type="number" min={qtyMin(it.unit_abbr)} step={qtyStep(it.unit_abbr)} max={bal != null ? bal : ''} value={it.quantity}
                          onChange={e => updateQty(it.product_id, e.target.value)}
                          className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
                        <button type="button" onClick={() => changeQty(it.product_id, 1)}
                          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
                        <button type="button" onClick={() => removeItem(it.product_id)}
                          className="ml-2 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-5 py-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={loading || items.length === 0}
              className={`px-5 py-2.5 text-white rounded-lg text-sm shadow-sm ${side.btn} disabled:opacity-50`}>
              {loading ? 'Processando...' : `Realizar ${side.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AvariaModal({ deposit, deposits, onClose, onDone }) {
  const [form, setForm] = useState({ deposit_id: deposit ? String(deposit.id) : '', description: '', items: [] });
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState('');
  const searchRef = useRef(null);

  const selId = parseInt(form.deposit_id, 10);

  useEffect(() => {
    if (!selId) { setBalance(null); setBalanceError(''); setForm(f => ({ ...f, items: [] })); return; }
    let active = true;
    setBalance(null);
    setBalanceError('');
    setForm(f => ({ ...f, items: [] }));
    api.get('/stock/balance/', { params: { deposit_id: selId } })
      .then(res => { if (active) setBalance(res.data || []); })
      .catch(err => { if (active) setBalanceError(err.response?.data?.detail || 'Erro ao carregar o saldo do depósito'); });
    return () => { active = false; };
  }, [selId]);

  const balOf = (pid) => {
    const b = (balance || []).find(x => x.product_id === pid);
    return b ? b.balance : null;
  };

  const searchResults = useMemo(() => {
    if (searchQ.length < 1 || !balance) return [];
    const lq = searchQ.toLowerCase();
    return balance.filter(p => (p.product_name || '').toLowerCase().includes(lq)).slice(0, 8);
  }, [searchQ, balance]);

  const addItem = (p) => {
    if (form.items.find(it => it.product_id === p.product_id)) return;
    setForm(f => ({ ...f, items: [...f.items, { product_id: p.product_id, product_name: p.product_name, quantity: 1, unit_abbr: p.unit_abbr || '' }] }));
    setSearchQ('');
    setTimeout(() => searchRef.current?.focus(), 50);
  };
  const changeQty = (pid, delta) => setForm(f => ({ ...f, items: f.items.map(it => {
    if (it.product_id !== pid) return it;
    const max = balOf(pid);
    const next = roundQty(it.quantity + delta, it.unit_abbr);
    return { ...it, quantity: Math.max(qtyMin(it.unit_abbr), max != null ? Math.min(next, max) : next) };
  }) }));
  const updateQty = (pid, value) => {
    if (value === '') return;
    const n = parseFloat(value);
    if (isNaN(n)) return;
    const max = balOf(pid);
    setForm(f => ({ ...f, items: f.items.map(it => it.product_id === pid ? { ...it, quantity: Math.max(qtyMin(it.unit_abbr), max != null ? Math.min(n, max) : roundQty(n, it.unit_abbr)) } : it) }));
  };
  const removeItem = (pid) => setForm(f => ({ ...f, items: f.items.filter(it => it.product_id !== pid) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deposit_id) { alert('Selecione o depósito'); return; }
    if (form.items.length === 0) { alert('Adicione pelo menos um produto'); return; }
    if (!form.description) { alert('Descreva a avaria'); return; }
    for (const it of form.items) {
      const max = balOf(it.product_id);
      if (max != null && it.quantity > max) {
        alert(`${it.product_name}: quantidade (${it.quantity}) excede o saldo no depósito (${max})`);
        return;
      }
    }
    setLoading(true);
    try {
      await api.post('/stock/avaria', {
        deposit_id: parseInt(form.deposit_id),
        description: form.description,
        items: form.items.map(it => ({ product_id: it.product_id, quantity: roundQty(it.quantity, it.unit_abbr) })),
      });
      alert('Avaria registrada com sucesso!');
      onDone();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao registrar avaria');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-red-50"><AlertTriangle size={18} className="text-red-600" /></div>
            <h2 className="text-lg font-bold">Registrar Avaria</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Depósito *</label>
              <select value={form.deposit_id} onChange={e => setForm({...form, deposit_id: e.target.value})}
                className="w-full px-3 py-2.5 border rounded-lg text-sm" required>
                <option value="">Selecione</option>
                {deposits.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição da Avaria *</label>
              <CaseInput placeholder="Ex: Produto danificado, vencido, quebrado..." value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full px-3 py-2.5 border rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Produtos</label>
              {balanceError && <p className="text-xs text-red-500 mb-2">{balanceError}</p>}
              <div className="relative">
                <input ref={searchRef} type="text" placeholder="Buscar produto..." value={searchQ} autoFocus
                  onChange={e => setSearchQ(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm" />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg z-10 max-h-40 overflow-y-auto">
                    {searchResults.map(p => (
                      <button key={p.product_id} type="button" onClick={() => addItem(p)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 border-b last:border-0 flex justify-between items-center">
                        <span className="flex-1">{p.product_name}</span>
                        <span className={`text-xs font-medium ${p.balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>Saldo: {p.balance}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!balance && !balanceError && selId && (
                <p className="text-sm text-gray-400 text-center py-6 mt-2">Carregando produtos do depósito...</p>
              )}
              {balance && balance.length === 0 && !balanceError && (
                <p className="text-sm text-gray-400 text-center py-6 mt-2">Nenhum produto com saldo neste depósito</p>
              )}
              {balance && searchQ && searchResults.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2 mt-2">Nenhum produto encontrado neste depósito</p>
              )}
              {form.items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6 mt-2">Busque e adicione produtos acima</p>
              ) : (
                <div className="space-y-2 mt-3">
                  {form.items.map(it => {
                    const bal = balOf(it.product_id);
                    return (
                      <div key={it.product_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-medium truncate">{it.product_name}</div>
                          <div className="text-xs text-gray-500">
                            Saldo: <span className={bal > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{bal != null ? bal : '—'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => changeQty(it.product_id, -1)}
                            className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
                          <input type="number" min={qtyMin(it.unit_abbr)} step={qtyStep(it.unit_abbr)} max={bal != null ? bal : ''} value={it.quantity}
                            onChange={e => updateQty(it.product_id, e.target.value)}
                            className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
                          <button type="button" onClick={() => changeQty(it.product_id, 1)}
                            className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
                          <button type="button" onClick={() => removeItem(it.product_id)}
                            className="ml-2 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="px-5 py-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={loading || form.items.length === 0}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 shadow-sm disabled:opacity-50">
              {loading ? 'Processando...' : 'Registrar Avaria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MovementsModal({ deposit, products, onClose }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMov, setEditMov] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: '', reason: '', notes: '', unit_price: '' });

  const load = useCallback(() => {
    if (!deposit) return;
    setLoading(true);
    api.get('/stock/movements/', { params: { deposit_id: deposit.id } })
      .then(res => setMovements(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deposit]);
  useEffect(() => { load(); }, [load]);

  const startEdit = (m) => {
    setEditMov(m);
    setEditForm({
      quantity: String(m.quantity),
      unit_price: m.unit_price ? formatNumberToCurrency(m.unit_price, 2) : '',
      reason: m.reason || '',
      notes: m.notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editMov) return;
    try {
      await api.put(`/stock/movements/${editMov.id}`, {
        quantity: roundQty(editForm.quantity, editUnit) || qtyMin(editUnit),
        unit_price: parseCurrencyToNumber(editForm.unit_price, 2),
        reason: editForm.reason || null,
        notes: editForm.notes || null,
      });
      setEditMov(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao editar');
    }
  };

  const handleDelete = async (id) => {
    // O histórico é imutável: isto grava um estorno, não apaga a linha.
    if (!confirm('Estornar esta movimentação? O lançamento original continua no histórico e um estorno será registrado ao lado dele.')) return;
    try {
      await api.delete(`/stock/movements/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao estornar');
    }
  };

  const prodName = (id) => { const p = products.find(p => p.id === id); return p ? productLabel(p) : '-'; };
  const editProduct = products.find(p => p.id === editMov?.product_id);
  const editUnit = editProduct?.unit?.abbreviation || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50"><Package size={20} className="text-brand-600" /></div>
            <h2 className="text-lg font-bold">Movimentações - {deposit?.name}</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-4">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Carregando...</p>
          ) : movements.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhuma movimentação neste depósito</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-center p-3">Qtd</th>
                  <th className="text-center p-3">Preço</th>
                  <th className="text-left p-3">Motivo</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id} className="border-t hover:bg-gray-50">
                    {editMov?.id === m.id ? (
                      <>
                        <td className="p-3 text-gray-500 text-xs">{m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="p-3 font-medium">{prodName(m.product_id)}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${m.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {m.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <input type="number" min={qtyMin(editUnit)} step={qtyStep(editUnit)} value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: e.target.value})}
                            className="w-16 px-1 py-1 border rounded text-sm text-center" />
                        </td>
                        <td className="p-3 text-center">
                          <input type="text" inputMode="decimal" value={editForm.unit_price} onChange={e => setEditForm({...editForm, unit_price: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                            className="w-20 px-1 py-1 border rounded text-sm text-right" />
                        </td>
                        <td className="p-3">
                          <CaseInput value={editForm.reason} onChange={e => setEditForm({...editForm, reason: e.target.value})}
                            className="w-full px-1 py-1 border rounded text-sm" />
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} className="p-1 text-green-600 hover:text-green-800" title="Salvar"><Save size={15} /></button>
                            <button onClick={() => setEditMov(null)} className="p-1 text-gray-400 hover:text-gray-600" title="Cancelar"><X size={15} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 text-gray-500 text-xs">{m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="p-3 font-medium">{m.product_name || prodName(m.product_id)}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${m.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {m.movement_type === 'entrada' ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                            {m.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-medium">{m.quantity}</td>
                        <td className="p-3 text-center text-gray-500">{m.movement_type === 'entrada' ? `R$ ${(m.unit_price || 0).toFixed(2)}` : '-'}</td>
                        <td className="p-3 text-xs text-gray-500">{m.source === 'requisicao' ? '-' : (m.reason || '-')}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {m.source !== 'requisicao' && (
                              <>
                                <button onClick={() => startEdit(m)} className="p-1 text-brand-600 hover:text-brand-800" title="Editar"><Edit size={14} /></button>
                                <button onClick={() => handleDelete(m.id)} className="p-1 text-red-600 hover:text-red-800" title="Estornar"><Trash2 size={14} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function StockBalanceModal({ deposit, onClose }) {
  const [balance, setBalance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deposit) return;
    setLoading(true);
    setError('');
    api.get('/stock/balance/', { params: { deposit_id: deposit.id } })
      .then(res => setBalance(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Erro ao carregar o saldo'))
      .finally(() => setLoading(false));
  }, [deposit]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-50"><ClipboardCheck size={20} className="text-green-600" /></div>
            <h2 className="text-lg font-bold">Saldo - {deposit?.name}</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-4">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Carregando...</p>
          ) : error ? (
            <p className="text-red-500 text-center py-8">{error}</p>
          ) : balance.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum saldo encontrado para este depósito</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-center p-3">Entradas</th>
                  <th className="text-center p-3">Saídas</th>
                  <th className="text-center p-3 font-bold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((item, i) => (
                  <tr key={item.product_id || i} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.product_name}</td>
                    <td className="p-3 text-center text-brand-600">{item.quantity_entries}</td>
                    <td className="p-3 text-center text-orange-600">{item.quantity_exits}</td>
                    <td className={`p-3 text-center font-bold ${item.balance > 0 ? 'text-green-600' : item.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {item.balance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function Deposits() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canManage = permissions?.['deposits_manage'] === 'edit';
  const [deposits, setDeposits] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', address: '', parent_id: '' });
  const [transferAction, setTransferAction] = useState(null);
  const [showAvaria, setShowAvaria] = useState(false);
  const [avariaDeposit, setAvariaDeposit] = useState(null);
  const [balanceDeposit, setBalanceDeposit] = useState(null);
  const [movementsDeposit, setMovementsDeposit] = useState(null);

  const load = () => {
    api.get('/deposits/mine').then(res => setDeposits(res.data)).catch(() => {});
  };
  const loadProducts = () => {
    api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
  };

  useEffect(() => { load(); loadProducts(); }, []);

  const { parents, childrenMap } = useMemo(() => {
    const p = deposits.filter(d => !d.parent_id);
    const cm = {};
    deposits.forEach(d => {
      if (d.parent_id) {
        if (!cm[d.parent_id]) cm[d.parent_id] = [];
        cm[d.parent_id].push(d);
      }
    });
    return { parents: p, childrenMap: cm };
  }, [deposits]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, parent_id: form.parent_id ? parseInt(form.parent_id) : null };
      if (editing) { await api.put(`/deposits/${editing.id}`, data); }
      else { await api.post('/deposits/', data); }
      setShowModal(false); setEditing(null); setForm({ name: '', description: '', address: '', parent_id: '' }); load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar depósito');
    }
  };

  const handleEdit = (d) => {
    setEditing(d);
    setForm({ name: d.name, description: d.description || '', address: d.address || '', parent_id: d.parent_id ? String(d.parent_id) : '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover depósito?')) return;
    try { await api.delete(`/deposits/${id}`); load(); } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao remover depósito');
    }
  };

  const handleAddSub = (parent) => {
    setEditing(null);
    setForm({ name: '', description: '', address: '', parent_id: String(parent.id) });
    setShowModal(true);
  };

  const DepositCard = ({ d, isChild }) => (
    <div className={`bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow ${isChild ? 'ml-8 border-l-4 border-orange-300' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isChild ? 'bg-orange-100' : 'bg-brand-100'}`}>
            <Warehouse size={20} className={isChild ? 'text-orange-600' : 'text-brand-600'} />
          </div>
          <div>
            <span className="font-semibold">{d.name}</span>
            {isChild && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Sub-depósito</span>}
          </div>
        </div>
      </div>
      {d.description && <p className="text-sm text-gray-500 mt-2">{d.description}</p>}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {isChild && (
          <button onClick={() => setTransferAction({ type: 'abastecimento', deposit: d })} className="flex items-center gap-1 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs hover:bg-brand-100 border border-brand-200">
            <ArrowRightLeft size={12} /> Abastecer
          </button>
        )}
        {!isChild && canManage && (
          <button onClick={() => handleAddSub(d)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs hover:bg-green-100 border border-green-200">
            <Plus size={12} /> Sub-depósito
          </button>
        )}
        <button onClick={() => { setAvariaDeposit(d); setShowAvaria(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 border border-red-200">
          <AlertTriangle size={12} /> Avaria
        </button>
        {isChild && (
          <button onClick={() => setTransferAction({ type: 'devolucao', deposit: d })} className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs hover:bg-orange-100 border border-orange-200">
            <ArrowRightLeft size={12} /> Devolver
          </button>
        )}
        <button onClick={() => setBalanceDeposit(d)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs hover:bg-green-100 border border-green-200">
          <ClipboardCheck size={12} /> Saldo
        </button>
        <button onClick={() => setMovementsDeposit(d)} className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg text-xs hover:bg-sky-100 border border-sky-200">
          <Package size={12} /> Mov.
        </button>
        {canManage && (
          <button onClick={() => handleEdit(d)} className="flex items-center gap-1 px-3 py-1.5 text-brand-600 rounded-lg text-xs hover:bg-brand-50 border border-brand-200">
            <Edit size={12} /> Editar
          </button>
        )}
        {canManage && (
          <button onClick={() => handleDelete(d.id)} className="flex items-center gap-1 px-3 py-1.5 text-red-600 rounded-lg text-xs hover:bg-red-50 border border-red-200">
            <Trash2 size={12} /> Remover
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Warehouse size={28} className="text-brand-600" />
          <h1 className="text-2xl font-bold">Depósitos</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/transfer-report')} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <BarChart3 size={18} /> Relatório
          </button>
          {canManage && (
            <button onClick={() => { setEditing(null); setForm({ name: '', description: '', address: '', parent_id: '' }); setShowModal(true); }}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 text-sm">
              <Plus size={18} /> Novo Depósito
            </button>
          )}
        </div>
      </div>

      {deposits.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Nenhum depósito cadastrado</p>
      ) : (
        <div className="space-y-4">
          {parents.map(p => (
            <div key={p.id}>
              <DepositCard d={p} />
              {childrenMap[p.id] && childrenMap[p.id].length > 0 && (
                <div className="mt-2 space-y-2">
                  {childrenMap[p.id].map(c => <DepositCard key={c.id} d={c} isChild />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : form.parent_id ? 'Novo Sub-depósito' : 'Novo Depósito'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <CaseInput placeholder="Nome *" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
              <CaseTextarea placeholder="Descrição" value={form.description} rows={2}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <CaseInput placeholder="Endereço" value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              {!form.parent_id && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Depósito Pai (criar como sub-depósito)</label>
                  <select value={form.parent_id} onChange={e => setForm({...form, parent_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">Nenhum (depósito principal)</option>
                    {deposits.filter(d => !d.parent_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              {form.parent_id && (
                <p className="text-xs text-gray-400">Sub-depósito de: <strong>{deposits.find(d => String(d.id) === form.parent_id)?.name}</strong></p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferAction && (
        <TransferModal type={transferAction.type} deposit={transferAction.deposit} deposits={deposits}
          onClose={() => setTransferAction(null)}
          onDone={() => { setTransferAction(null); load(); loadProducts(); }} />
      )}

      {showAvaria && (
        <AvariaModal deposit={avariaDeposit} deposits={deposits}
          onClose={() => { setShowAvaria(false); setAvariaDeposit(null); }}
          onDone={() => { setShowAvaria(false); setAvariaDeposit(null); load(); loadProducts(); }} />
      )}
      {balanceDeposit && (
        <StockBalanceModal deposit={balanceDeposit} onClose={() => setBalanceDeposit(null)} />
      )}
      {movementsDeposit && (
        <MovementsModal deposit={movementsDeposit} products={products}
          onClose={() => setMovementsDeposit(null)} />
      )}
    </div>
  );
}
