import { useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { confirmar } from '../../utils/confirmar';
import { qtyStep, roundQty } from '../../services/masks';

function initialQuantities(requisicao) {
  const quantities = {};
  requisicao.items.forEach(item => {
    quantities[item.product_id] = item.quantity_fulfilled || item.quantity_approved || item.quantity_requested || 0;
  });
  return quantities;
}

function receivingItems(requisicao, receiveQty, unitOf) {
  return requisicao.items.map(item => ({
    product_id: item.product_id,
    quantity_received: roundQty(receiveQty[item.product_id] ?? 0, unitOf(item)),
  }));
}

function receiveError(err) {
  return err.response?.data?.detail || 'Erro ao receber';
}

function ReceivingItem({ item, quantity, unitOf, onChange }) {
  const unit = unitOf(item);
  const sent = item.quantity_fulfilled || item.quantity_approved || item.quantity_requested || 0;

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
      <span className="text-sm font-medium flex-1">{item.product_name}</span>
      <span className="text-xs text-gray-500 mr-2">Enviado: {sent}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(Math.max(0, roundQty((quantity ?? 0) - qtyStep(unit), unit)))}
          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
        <input type="number" min="0" max={sent} step={qtyStep(unit)} value={quantity ?? 0}
          onChange={event => {
            if (event.target.value === '') return;
            const number = parseFloat(event.target.value);
            if (isNaN(number)) return;
            onChange(Math.max(0, Math.min(sent, roundQty(number, unit))));
          }}
          className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
        <button type="button" onClick={() => onChange(Math.min(sent, roundQty((quantity ?? 0) + qtyStep(unit), unit)))}
          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
      </div>
    </div>
  );
}

export default function RecebimentoModal({ requisicao, unitOf, onClose, onDone }) {
  const { notificar } = useNotificacao();
  const [receiveQty, setReceiveQty] = useState(() => initialQuantities(requisicao));

  const handleReceive = async () => {
    const items = receivingItems(requisicao, receiveQty, unitOf);
    if (!confirmar(`Confirmar recebimento da requisição #${requisicao.id} no depósito? Isso criará movimentações de entrada no estoque.`)) return;
    try {
      await api.put(`/requisicoes/${requisicao.id}/receive`, { items });
      onClose();
      onDone();
    } catch (err) {
      notificar.erro(receiveError(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white">
          <div className="p-2 rounded-xl bg-teal-100 text-teal-600">
            <ArrowUpCircle size={20} />
          </div>
          <h2 className="text-lg font-bold">Conferir Recebimento #{requisicao.id}</h2>
          <span className="ml-auto text-sm text-gray-500">Enviado por {requisicao.deposit_fulfilling_name || '-'}</span>
        </div>
        <div className="px-6 py-4 space-y-2">
          <p className="text-sm text-gray-500 mb-3">Confira a quantidade enviada e informe a quantidade realmente recebida de cada item.</p>
          {requisicao.items.map(item => (
            <ReceivingItem key={item.product_id} item={item} quantity={receiveQty[item.product_id]}
              unitOf={unitOf}
              onChange={value => setReceiveQty(current => ({ ...current, [item.product_id]: value }))} />
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button type="button" onClick={handleReceive}
            className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-sm">Confirmar Recebimento</button>
        </div>
      </div>
    </div>
  );
}
