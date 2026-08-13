import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AtendimentoModal from './AtendimentoModal';
import ImpressaoRequisicao from './ImpressaoRequisicao';
import RecebimentoModal from './RecebimentoModal';
import RequisicaoForm from './RequisicaoForm';
import RequisicaoRow from './RequisicaoRow';
import { canFulfill as canFulfillRequisicao, canManage as canManageRequisicao, canReceive as canReceiveRequisicao } from './permissoes';

const statusLabels = {
  pendente: 'Pendente',
  aprovado: 'Liberada',
  atendido: 'Atendida',
  recebido: 'Recebida',
  cancelado: 'Cancelada',
};

const statusColors = {
  pendente: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-brand-100 text-brand-700',
  atendido: 'bg-green-100 text-green-700',
  recebido: 'bg-teal-100 text-teal-700',
  cancelado: 'bg-red-100 text-red-700',
};

export default function Requisicoes() {
  const { user } = useAuth();
  const [requisicoes, setRequisicoes] = useState([]);
  const [products, setProducts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [printing, setPrinting] = useState(null);
  const [fulfilling, setFulfilling] = useState(null);
  const [receiving, setReceiving] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    api.get('/requisicoes/', { params })
      .then(res => setRequisicoes(res.data))
      .catch(() => {});
  }, [statusFilter]);

  useEffect(() => {
    api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
    api.get('/deposits/mine').then(res => setDeposits(res.data)).catch(() => {});
    api.get('/auth/users').then(res => setUsers(res.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const productUnitMap = useMemo(() => {
    const map = {};
    products.forEach(product => { map[product.id] = product.unit?.abbreviation || ''; });
    return map;
  }, [products]);

  // Kept here because all three flow components need the same product-unit lookup.
  const unitOf = item => productUnitMap[item.product_id] || item.unit_abbr || '';

  const userMap = useMemo(() => {
    const map = {};
    users.forEach(currentUser => { map[currentUser.id] = currentUser.name; });
    return map;
  }, [users]);

  const handleEdit = requisicao => {
    setEditing(requisicao);
    setShowModal(true);
  };

  const handleApprove = async requisicao => {
    const items = requisicao.items.map(item => ({
      product_id: item.product_id,
      quantity_approved: item.quantity_approved || item.quantity_requested,
    }));
    const totals = items.reduce((sum, item) => sum + item.quantity_approved, 0);
    if (!confirm(`Liberar requisição #${requisicao.id} (${totals} ite${totals === 1 ? 'm' : 'ns'}) para atendimento?`)) return;
    try {
      await api.put(`/requisicoes/${requisicao.id}/approve`, { items });
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao liberar');
    }
  };

  const handleCancel = async requisicao => {
    if (!confirm(`Cancelar requisição #${requisicao.id}?`)) return;
    try {
      await api.put(`/requisicoes/${requisicao.id}/cancel`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao cancelar');
    }
  };

  const handleDelete = async id => {
    if (!confirm('Remover esta requisição?')) return;
    try {
      await api.delete(`/requisicoes/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao remover');
    }
  };

  const permissions = {
    canManage: requisicao => canManageRequisicao(user, requisicao),
    canFulfill: requisicao => canFulfillRequisicao(user, requisicao),
    canReceive: requisicao => canReceiveRequisicao(user, requisicao),
  };

  const handlers = {
    onPrint: setPrinting,
    onEdit: handleEdit,
    onApprove: handleApprove,
    onFulfill: setFulfilling,
    onReceive: setReceiving,
    onCancel: handleCancel,
    onDelete: handleDelete,
  };

  const closeForm = () => {
    setShowModal(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList size={28} className="text-orange-600" />
          <h1 className="text-2xl font-bold">Requisições de Estoque</h1>
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Liberadas</option>
            <option value="atendido">Atendidas</option>
            <option value="recebido">Recebidas</option>
            <option value="cancelado">Canceladas</option>
          </select>
          <button onClick={() => { setEditing(null); setShowModal(true); }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700 text-sm">
            <Plus size={18} /> Nova Requisição
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Solicitante</th>
              <th className="text-left p-3">Dep. Solicitante</th>
              <th className="text-left p-3">Dep. Atendimento</th>
              <th className="text-center p-3">Itens</th>
              <th className="text-center p-3">Status</th>
              <th className="text-left p-3">Data</th>
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {requisicoes.map(requisicao => (
              <RequisicaoRow key={requisicao.id} requisicao={requisicao}
                statusLabels={statusLabels} statusColors={statusColors}
                permissions={permissions} handlers={handlers} />
            ))}
            {requisicoes.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhuma requisição encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <RequisicaoForm editing={editing} products={products} deposits={deposits}
        unitOf={unitOf} onClose={closeForm} onSaved={() => { closeForm(); load(); }} />}
      {fulfilling && <AtendimentoModal requisicao={fulfilling} unitOf={unitOf}
        onClose={() => setFulfilling(null)} onDone={load} />}
      {receiving && <RecebimentoModal requisicao={receiving} unitOf={unitOf}
        onClose={() => setReceiving(null)} onDone={load} />}
      {printing && <ImpressaoRequisicao requisicao={printing} userMap={userMap}
        statusLabels={statusLabels} onClose={() => setPrinting(null)} />}
    </div>
  );
}
