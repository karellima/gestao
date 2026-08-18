import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import { CaseInput, CaseTextarea } from '../../components/CaseInput';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { currencyToDigits, formatDigitsToCurrency, formatNumberToCurrency, parseCurrencyToNumber, qtyMin, qtyStep, roundQty } from '../../services/masks';
import SearchInput from './SearchInput';

const emptyForm = () => ({
  deposit_requesting_id: '',
  deposit_fulfilling_id: '',
  reason: '',
  notes: '',
  items: [],
});

function formFromRequisicao(requisicao) {
  if (!requisicao) return emptyForm();
  return {
    deposit_requesting_id: String(requisicao.deposit_requesting_id),
    deposit_fulfilling_id: String(requisicao.deposit_fulfilling_id),
    reason: requisicao.reason || '',
    notes: requisicao.notes || '',
    items: requisicao.items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity_requested: item.quantity_requested,
      unit_price: item.unit_price ? formatNumberToCurrency(item.unit_price, 2) : '',
    })),
  };
}

function validationMessage(form) {
  if (!form.deposit_requesting_id) return 'Selecione o depósito solicitante';
  if (!form.deposit_fulfilling_id) return 'Selecione o depósito de atendimento';
  if (form.items.length === 0) return 'Adicione pelo menos um produto';
  return null;
}

function validateForm(form, notificar) {
  const message = validationMessage(form);
  if (!message) return true;
  notificar.aviso(message);
  return false;
}

function requestData(form, unitOf) {
  return {
    deposit_requesting_id: parseInt(form.deposit_requesting_id),
    deposit_fulfilling_id: parseInt(form.deposit_fulfilling_id),
    reason: form.reason || null,
    notes: form.notes || null,
    items: form.items.map(item => {
      const unit = unitOf(item);
      const quantity = roundQty(item.quantity_requested, unit);
      return {
        product_id: item.product_id,
        quantity_requested: quantity > 0 ? quantity : qtyMin(unit),
        unit_price: item.unit_price ? parseCurrencyToNumber(item.unit_price, 2) : null,
      };
    }),
  };
}

async function saveRequest(editing, data) {
  if (editing) {
    return api.put(`/requisicoes/${editing.id}`, data);
  }
  return api.post('/requisicoes/', data);
}

function saveError(err) {
  return err.response?.data?.detail || 'Erro ao salvar requisição';
}

export default function RequisicaoForm({ editing, products, deposits, unitOf, onClose, onSaved }) {
  const { notificar } = useNotificacao();
  const [form, setForm] = useState(() => formFromRequisicao(editing));
  const [focusQtyId, setFocusQtyId] = useState(null);
  const searchRef = useRef(null);
  const qtyRefs = useRef({});

  useEffect(() => {
    if (focusQtyId != null && qtyRefs.current[focusQtyId]) {
      qtyRefs.current[focusQtyId].focus();
      qtyRefs.current[focusQtyId].select();
      setFocusQtyId(null);
    }
  }, [focusQtyId, form.items]);

  const prodLabel = product => product.unit?.abbreviation ? `${product.name} ${product.unit.abbreviation}` : product.name;

  const addItem = product => {
    if (form.items.find(item => item.product_id === product.id)) return;
    setForm(current => ({ ...current, items: [...current.items, {
      product_id: product.id,
      product_name: prodLabel(product),
      quantity_requested: 1,
      unit_abbr: product.unit?.abbreviation || '',
      unit_price: formatNumberToCurrency(product.price || 0, 2),
    }] }));
    setFocusQtyId(product.id);
  };

  const removeItem = productId => setForm(current => ({
    ...current,
    items: current.items.filter(item => item.product_id !== productId),
  }));

  const updateItem = (productId, field, value) => setForm(current => ({
    ...current,
    items: current.items.map(item => item.product_id === productId ? { ...item, [field]: value } : item),
  }));

  const resetForm = () => setForm(emptyForm());

  const handleSubmit = async event => {
    event.preventDefault();
    if (!validateForm(form, notificar)) return;
    try {
      await saveRequest(editing, requestData(form, unitOf));
      resetForm();
      onSaved();
    } catch (err) {
      notificar.erro(saveError(err));
    }
  };

  const closeForm = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white">
          <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
            <ClipboardList size={20} />
          </div>
          <h2 className="text-lg font-bold">{editing ? 'Editar' : 'Nova'} Requisição</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Depósito Solicitante *</label>
                <select value={form.deposit_requesting_id}
                  onChange={e => setForm({ ...form, deposit_requesting_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required>
                  <option value="">Selecione</option>
                  {deposits.filter(deposit => !deposit.parent_id).map(deposit => <option key={deposit.id} value={deposit.id}>{deposit.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Depósito Atendimento *</label>
                <select value={form.deposit_fulfilling_id}
                  onChange={e => setForm({ ...form, deposit_fulfilling_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required>
                  <option value="">Selecione</option>
                  {deposits.filter(deposit => !deposit.parent_id).map(deposit => <option key={deposit.id} value={deposit.id}>{deposit.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Produtos</label>
              <SearchInput products={products} onSelect={addItem} searchRef={searchRef} />
              {form.items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6 mt-2">Busque e adicione produtos acima</p>
              ) : (
                <div className="space-y-2 mt-3">
                  {form.items.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium flex-1">{item.product_name}</span>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => updateItem(item.product_id, 'quantity_requested', Math.max(qtyMin(unitOf(item)), roundQty((item.quantity_requested || qtyMin(unitOf(item))) - qtyStep(unitOf(item)), unitOf(item))))}
                          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
                        <input type="number" min={qtyMin(unitOf(item))} step={qtyStep(unitOf(item))} value={item.quantity_requested}
                          ref={element => { qtyRefs.current[item.product_id] = element; }}
                          onChange={e => {
                            if (e.target.value === '') return;
                            const number = parseFloat(e.target.value);
                            if (isNaN(number)) return;
                            updateItem(item.product_id, 'quantity_requested', Math.max(qtyMin(unitOf(item)), roundQty(number, unitOf(item))));
                          }}
                          className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
                        <button type="button" onClick={() => updateItem(item.product_id, 'quantity_requested', roundQty((item.quantity_requested || qtyMin(unitOf(item))) + qtyStep(unitOf(item)), unitOf(item)))}
                          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
                        <span className="text-gray-300 mx-1">|</span>
                        <span className="text-xs text-gray-500">R$</span>
                        <input type="text" inputMode="decimal" value={item.unit_price}
                          onChange={e => updateItem(item.product_id, 'unit_price', formatDigitsToCurrency(currencyToDigits(e.target.value), 2))}
                          className="w-16 px-1 py-1 border rounded text-sm text-right" />
                        <button type="button" onClick={() => removeItem(item.product_id)}
                          className="ml-1 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motivo / Destino</label>
              <CaseInput placeholder="Ex: Uso interno, Transferência, Cliente" value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
              <CaseTextarea placeholder="Observações" value={form.notes} rows={2}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={closeForm}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
            <button type="submit"
              className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 shadow-sm">
              {editing ? 'Salvar Alterações' : 'Criar Requisição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
