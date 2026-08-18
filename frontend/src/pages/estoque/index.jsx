import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Package } from 'lucide-react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { formatNumberToCurrency } from '../../services/masks';
import { sortItems } from '../ordenacao';
import { getEmptyForm, toPayload } from './movimentacao-form';
import { getMovementSortValue } from './ordenacao-de-movimentacoes';
import TabelaDeMovimentacoes from './TabelaDeMovimentacoes';
import MovimentacaoForm from './MovimentacaoForm';
import { confirmar } from '../../utils/confirmar';

export default function Stock() {
  const { notificar } = useNotificacao();
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('entrada');
  const [sortConfig, setSortConfig] = useState({ key: 'movement_date', direction: 'desc' });
  const [form, setForm] = useState(getEmptyForm());
  const qtyRef = useRef(null);

  useEffect(() => {
    if (form.product_id && showModal) qtyRef.current?.focus();
  }, [form.product_id, showModal]);

  const loadMovements = useCallback(() => {
    api.get('/stock/movements/')
      .then(res => setMovements(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
    api.get('/deposits/mine').then(res => setDeposits(res.data)).catch(() => {});
    loadMovements();
  }, [loadMovements]);

  const getProductName = useCallback((id) => {
    const product = products.find(item => item.id === id);
    if (!product) return '-';
    return product.display_name || (product.unit?.abbreviation ? `${product.name} ${product.unit.abbreviation}` : product.name);
  }, [products]);

  const getDepositName = useCallback((id) => deposits.find(deposit => deposit.id === id)?.name || '-', [deposits]);

  const sortedMovements = useMemo(() => sortItems(
    movements,
    sortConfig,
    (movement, key) => getMovementSortValue(movement, key, getProductName, getDepositName),
  ), [movements, sortConfig, getProductName, getDepositName]);

  const handleSort = (key, direction) => setSortConfig({ key, direction });

  const resetForm = () => {
    setForm(getEmptyForm());
    setEditing(null);
  };

  const handleEdit = (movement) => {
    setEditing(movement);
    setActiveTab(movement.movement_type);
    setForm({
      product_id: String(movement.product_id),
      deposit_id: String(movement.deposit_id),
      movement_date: movement.movement_date ? movement.movement_date.split('T')[0] : '',
      quantity: String(movement.quantity),
      unit_price: movement.unit_price ? formatNumberToCurrency(movement.unit_price, 2) : '',
      reason: movement.reason || '',
      notes: movement.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    // O histórico é imutável: isto grava um estorno, não apaga a linha.
    if (!confirmar('Estornar esta movimentação? O lançamento original continua no histórico e um estorno será registrado ao lado dele.')) return;
    try {
      await api.delete(`/stock/movements/${id}`);
      loadMovements();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao estornar movimentação');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const data = toPayload(form, { tipo: activeTab, unidade: selectedUnit });
      if (editing) await api.put(`/stock/movements/${editing.id}`, data);
      else await api.post('/stock/movements/', data);
      setShowModal(false); resetForm(); loadMovements();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao salvar movimentação');
    }
  };

  const productOptions = products.map(product => ({ value: product.id, label: getProductName(product.id) }));
  const depositOptions = deposits.map(deposit => ({ value: deposit.id, label: deposit.name }));
  const selectedProduct = products.find(product => product.id === parseInt(form.product_id, 10));
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

      <TabelaDeMovimentacoes
        movements={sortedMovements}
        sortConfig={sortConfig}
        onSort={handleSort}
        getProductName={getProductName}
        getDepositName={getDepositName}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showModal && (
        <MovimentacaoForm
          editing={editing}
          activeTab={activeTab}
          form={form}
          setForm={setForm}
          depositOptions={depositOptions}
          productOptions={productOptions}
          selectedUnit={selectedUnit}
          qtyRef={qtyRef}
          onSubmit={handleSubmit}
          onCancel={() => { setShowModal(false); resetForm(); }}
          onTabChange={setActiveTab}
        />
      )}
    </div>
  );
}
