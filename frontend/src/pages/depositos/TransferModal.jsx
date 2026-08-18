import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { qtyStep, qtyMin, roundQty } from '../../services/masks';
import useItensDeMovimentacao from './useItensDeMovimentacao';

const SIDES = {
  abastecimento: { label: 'Abastecimento', icon: ArrowRightLeft, color: 'text-brand-600', bg: 'bg-brand-50', btn: 'bg-brand-600 hover:bg-brand-700' },
  devolucao: { label: 'Devolução', icon: ArrowRightLeft, color: 'text-orange-600', bg: 'bg-orange-50', btn: 'bg-orange-600 hover:bg-orange-700' },
  avaria: { label: 'Avaria', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', btn: 'bg-red-600 hover:bg-red-700' },
};

export default function TransferModal({ type, deposit, deposits, onClose, onDone }) {
  const { notificar } = useNotificacao();
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

  const { balOf, addItem, changeQty, updateQty, removeItem } = useItensDeMovimentacao({
    items,
    balance: srcBalance,
    setItems,
    setSearchQ,
    searchRef,
  });

  const searchResults = useMemo(() => {
    if (searchQ.length < 1 || !srcBalance) return [];
    const lq = searchQ.toLowerCase();
    return srcBalance.filter(p => (p.product_name || '').toLowerCase().includes(lq)).slice(0, 8);
  }, [searchQ, srcBalance]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { notificar.aviso('Adicione pelo menos um produto'); return; }
    for (const item of items) {
      const max = balOf(item.product_id);
      if (max != null && item.quantity > max) {
        notificar.aviso(`${item.product_name}: quantidade (${item.quantity}) excede o saldo no depósito (${max})`);
        return;
      }
    }
    setLoading(true);
    try {
      await api.post('/stock/transfer', {
        source_deposit_id: srcId,
        destination_deposit_id: dstId,
        transfer_type: type,
        items: items.map(item => ({ product_id: item.product_id, quantity: roundQty(item.quantity, item.unit_abbr) })),
      });
      notificar.sucesso(`${side.label} realizado com sucesso!`);
      onDone();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || `Erro ao realizar ${side.label.toLowerCase()}`);
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
                {items.map(item => {
                  const bal = balOf(item.product_id);
                  return (
                    <div key={item.product_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm font-medium truncate">{item.product_name}</div>
                        <div className="text-xs text-gray-500">
                          {type === 'abastecimento' ? 'Saldo no Pai' : 'Saldo'}: <span className={bal > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{bal != null ? bal : '—'}</span>
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
