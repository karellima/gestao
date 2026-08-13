import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { CaseInput } from '../../components/CaseInput';
import { qtyStep, qtyMin, roundQty } from '../../services/masks';
import useItensDeMovimentacao from './useItensDeMovimentacao';

export default function AvariaModal({ deposit, deposits, onClose, onDone }) {
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

  const setItems = (update) => setForm(formState => ({ ...formState, items: update(formState.items) }));
  const { balOf, addItem, changeQty, updateQty, removeItem } = useItensDeMovimentacao({
    items: form.items,
    balance,
    setItems,
    setSearchQ,
    searchRef,
  });

  const searchResults = useMemo(() => {
    if (searchQ.length < 1 || !balance) return [];
    const lq = searchQ.toLowerCase();
    return balance.filter(p => (p.product_name || '').toLowerCase().includes(lq)).slice(0, 8);
  }, [searchQ, balance]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deposit_id) { alert('Selecione o depósito'); return; }
    if (form.items.length === 0) { alert('Adicione pelo menos um produto'); return; }
    if (!form.description) { alert('Descreva a avaria'); return; }
    const invalidItem = form.items.find(item => {
      const max = balOf(item.product_id);
      return max != null && item.quantity > max;
    });
    if (invalidItem) {
      const max = balOf(invalidItem.product_id);
      alert(`${invalidItem.product_name}: quantidade (${invalidItem.quantity}) excede o saldo no depósito (${max})`);
      return;
    }
    setLoading(true);
    try {
      await api.post('/stock/avaria', {
        deposit_id: parseInt(form.deposit_id),
        description: form.description,
        items: form.items.map(item => ({ product_id: item.product_id, quantity: roundQty(item.quantity, item.unit_abbr) })),
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
                  {form.items.map(item => {
                    const bal = balOf(item.product_id);
                    return (
                      <div key={item.product_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-medium truncate">{item.product_name}</div>
                          <div className="text-xs text-gray-500">
                            Saldo: <span className={bal > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{bal != null ? bal : '—'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => changeQty(item.product_id, -1)}
                            className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
                          <input type="number" min={qtyMin(item.unit_abbr)} step={qtyStep(item.unit_abbr)} max={bal != null ? bal : ''} value={item.quantity}
                            onChange={e => updateQty(item.product_id, e.target.value)}
                            className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
                          <button type="button" onClick={() => changeQty(item.product_id, 1)}
                            className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
                          <button type="button" onClick={() => removeItem(item.product_id)}
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
