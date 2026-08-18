import { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Edit, Package, Save, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { CaseInput } from '../../components/CaseInput';
import { currencyToDigits, formatDigitsToCurrency, formatNumberToCurrency, parseCurrencyToNumber, qtyStep, qtyMin, roundQty } from '../../services/masks';

const productLabel = (product) => product?.display_name || (product?.unit?.abbreviation ? `${product.name} ${product.unit.abbreviation}` : product?.name || '');

function MovementEditRow({ movement, productName, editUnit, editForm, setEditForm, saveEdit, setEditMov }) {
  return (
    <tr>
      <td className="p-3 text-gray-500 text-xs">{movement.movement_date ? new Date(movement.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
      <td className="p-3 font-medium">{productName(movement.product_id)}</td>
      <td className="p-3 text-center">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${movement.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {movement.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
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
    </tr>
  );
}

function MovementViewRow({ movement, productName, startEdit, handleDelete }) {
  return (
    <tr>
      <td className="p-3 text-gray-500 text-xs">{movement.movement_date ? new Date(movement.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
      <td className="p-3 font-medium">{movement.product_name || productName(movement.product_id)}</td>
      <td className="p-3 text-center">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${movement.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {movement.movement_type === 'entrada' ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
          {movement.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
      </td>
      <td className="p-3 text-center font-medium">{movement.quantity}</td>
      <td className="p-3 text-center text-gray-500">{movement.movement_type === 'entrada' ? `R$ ${(movement.unit_price || 0).toFixed(2)}` : '-'}</td>
      <td className="p-3 text-xs text-gray-500">{movement.source === 'requisicao' ? '-' : (movement.reason || '-')}</td>
      <td className="p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {movement.source !== 'requisicao' && (
            <>
              <button onClick={() => startEdit(movement)} className="p-1 text-brand-600 hover:text-brand-800" title="Editar"><Edit size={14} /></button>
              <button onClick={() => handleDelete(movement.id)} className="p-1 text-red-600 hover:text-red-800" title="Estornar"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function MovementRow({ movement, editMov, ...props }) {
  return editMov?.id === movement.id
    ? <MovementEditRow movement={movement} {...props} />
    : <MovementViewRow movement={movement} {...props} />;
}

function MovementTable({ movements, editMov, editForm, setEditForm, editUnit, productName, startEdit, handleDelete, saveEdit, setEditMov }) {
  return (
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
        {movements.map(movement => (
          <MovementRow key={movement.id} movement={movement} editMov={editMov}
            editForm={editForm} setEditForm={setEditForm} editUnit={editUnit}
            productName={productName} startEdit={startEdit} handleDelete={handleDelete}
            saveEdit={saveEdit} setEditMov={setEditMov} />
        ))}
      </tbody>
    </table>
  );
}

export default function MovementsModal({ deposit, products, onClose }) {
  const { notificar } = useNotificacao();
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

  const startEdit = (movement) => {
    setEditMov(movement);
    setEditForm({
      quantity: String(movement.quantity),
      unit_price: movement.unit_price ? formatNumberToCurrency(movement.unit_price, 2) : '',
      reason: movement.reason || '',
      notes: movement.notes || '',
    });
  };

  const editProduct = products.find(product => product.id === editMov?.product_id);
  const editUnit = editProduct?.unit?.abbreviation || '';

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
      notificar.erro(err.response?.data?.detail || 'Erro ao editar');
    }
  };

  const handleDelete = async (id) => {
    // O histórico é imutável: isto grava um estorno, não apaga a linha.
    if (!confirm('Estornar esta movimentação? O lançamento original continua no histórico e um estorno será registrado ao lado dele.')) return;
    try {
      await api.delete(`/stock/movements/${id}`);
      load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao estornar');
    }
  };

  const productName = (id) => { const product = products.find(item => item.id === id); return product ? productLabel(product) : '-'; };

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
            <MovementTable movements={movements} editMov={editMov} editForm={editForm}
              setEditForm={setEditForm} editUnit={editUnit} productName={productName}
              startEdit={startEdit} handleDelete={handleDelete} saveEdit={saveEdit}
              setEditMov={setEditMov} />
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 border rounded-lg text-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}
