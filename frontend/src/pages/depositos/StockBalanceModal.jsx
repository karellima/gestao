import { useEffect, useState } from 'react';
import { ClipboardCheck, X } from 'lucide-react';
import api from '../../services/api';

export default function StockBalanceModal({ deposit, onClose }) {
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
