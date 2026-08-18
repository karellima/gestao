import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { qtyStep, roundQty } from '../../services/masks';

function initialQuantities(requisicao, balance) {
  const quantities = {};
  requisicao.items.forEach(item => {
    const approved = item.quantity_approved || item.quantity_requested || 0;
    const available = balance[item.product_id];
    quantities[item.product_id] = available > 0 ? Math.min(approved, available) : approved;
  });
  return quantities;
}

function fulfillmentItems(requisicao, fulfillQty, unitOf) {
  return requisicao.items.map(item => ({
    product_id: item.product_id,
    quantity_fulfilled: roundQty(fulfillQty[item.product_id] ?? 0, unitOf(item)),
  }));
}

function exceededItems(requisicao, fulfillQty) {
  return requisicao.items.filter(item => (
    (fulfillQty[item.product_id] || 0) > (item.quantity_approved || item.quantity_requested)
  ));
}

function confirmationMessage(requisicao, exceeded, fulfillQty) {
  if (exceeded.length === 0) {
    return `Confirmar atendimento da requisição #${requisicao.id}? Isso criará movimentações de saída no estoque.`;
  }
  const message = exceeded.map(item => `${item.product_name}: entregar ${fulfillQty[item.product_id]} (solicitado ${item.quantity_requested})`).join('\n');
  return `Atenção! A quantidade de alguns itens é MAIOR que a solicitada:\n\n${message}\n\nDeseja continuar mesmo assim?`;
}

async function openFulfill(requisicao) {
  const balance = {};
  try {
    const response = await api.get(`/stock/balance/?deposit_id=${requisicao.deposit_fulfilling_id}`);
    (response.data || []).forEach(item => { balance[item.product_id] = item.balance; });
  } catch {
    // Saldo indisponível não bloqueia o atendimento.
  }
  return balance;
}

function fulfillError(err) {
  return err.response?.data?.detail || 'Erro ao atender';
}

function FulfillmentItem({ item, balance, quantity, unitOf, onChange }) {
  const unit = unitOf(item);
  const approved = item.quantity_approved || item.quantity_requested;
  const available = balance[item.product_id];
  const balanceLabel = available === undefined ? null : Math.max(0, available);
  const over = available > 0 && (quantity || 0) > available;
  const max = available > 0 ? available : approved;

  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <div className="text-sm font-medium truncate">{item.product_name}</div>
          <div className="text-xs text-gray-500">
            Solicitado: {item.quantity_requested}
            {balanceLabel !== null ? ` · Saldo no Pai: ${balanceLabel}` : ''}
          </div>
          {over && <div className="text-xs text-red-600 mt-0.5">Atenção: quantidade maior que o saldo no depósito pai ({available})</div>}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onChange(Math.max(0, roundQty((quantity || 0) - qtyStep(unit), unit)))}
            className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
          <input type="number" min="0" step={qtyStep(unit)} value={quantity ?? 0}
            onChange={event => {
              if (event.target.value === '') return;
              const number = parseFloat(event.target.value);
              if (isNaN(number)) return;
              onChange(Math.max(0, Math.min(max, roundQty(number, unit))));
            }}
            className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
          <button type="button" onClick={() => onChange(Math.min(max, roundQty((quantity || 0) + qtyStep(unit), unit)))}
            className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
        </div>
      </div>
    </div>
  );
}

export default function AtendimentoModal({ requisicao, unitOf, onClose, onDone }) {
  const { notificar } = useNotificacao();
  const [fulfillQty, setFulfillQty] = useState({});
  const [parentBalance, setParentBalance] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    openFulfill(requisicao).then(balance => {
      if (active) {
        setParentBalance(balance);
        setFulfillQty(initialQuantities(requisicao, balance));
        setReady(true);
      }
    });
    return () => { active = false; };
  }, [requisicao]);

  const handleFulfill = async () => {
    const items = fulfillmentItems(requisicao, fulfillQty, unitOf);
    const exceeded = exceededItems(requisicao, fulfillQty);
    if (!confirm(confirmationMessage(requisicao, exceeded, fulfillQty))) return;
    try {
      await api.put(`/requisicoes/${requisicao.id}/fulfill`, { items });
      onClose();
      onDone();
    } catch (err) {
      notificar.erro(fulfillError(err));
    }
  };

  if (!ready) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white">
          <div className="p-2 rounded-xl bg-green-100 text-green-600">
            <Truck size={20} />
          </div>
          <h2 className="text-lg font-bold">Atender Requisição #{requisicao.id}</h2>
          <span className="ml-auto text-sm text-gray-500">Liberada por {requisicao.approver_name || '-'}</span>
        </div>
        <div className="px-6 py-4 space-y-2">
          <p className="text-sm text-gray-500 mb-3">Informe a quantidade entregue de cada item (parcial ou completa). Se informar mais que o solicitado, será pedida uma confirmação.</p>
          {requisicao.items.map(item => (
            <FulfillmentItem key={item.product_id} item={item} balance={parentBalance}
              quantity={fulfillQty[item.product_id]} unitOf={unitOf}
              onChange={value => setFulfillQty(current => ({ ...current, [item.product_id]: value }))} />
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button type="button" onClick={handleFulfill}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm">Confirmar Atendimento</button>
        </div>
      </div>
    </div>
  );
}
