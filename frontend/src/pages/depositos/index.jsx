import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BarChart3, ClipboardCheck, Edit, Package, Plus, Trash2, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { CaseInput, CaseTextarea } from '../../components/CaseInput';
import AvariaModal from './AvariaModal';
import MovementsModal from './MovementsModal';
import StockBalanceModal from './StockBalanceModal';
import TransferModal from './TransferModal';

function DepositCard({ deposit, isChild, canManage, onAddSub, onTransfer, onAvaria, onBalance, onMovements, onEdit, onDelete }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow ${isChild ? 'ml-8 border-l-4 border-orange-300' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isChild ? 'bg-orange-100' : 'bg-brand-100'}`}>
            <Warehouse size={20} className={isChild ? 'text-orange-600' : 'text-brand-600'} />
          </div>
          <div>
            <span className="font-semibold">{deposit.name}</span>
            {isChild && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Sub-depósito</span>}
          </div>
        </div>
      </div>
      {deposit.description && <p className="text-sm text-gray-500 mt-2">{deposit.description}</p>}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {isChild && (
          <button onClick={() => onTransfer({ type: 'abastecimento', deposit })} className="flex items-center gap-1 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs hover:bg-brand-100 border border-brand-200">
            <ArrowRightLeft size={12} /> Abastecer
          </button>
        )}
        {!isChild && canManage && (
          <button onClick={() => onAddSub(deposit)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs hover:bg-green-100 border border-green-200">
            <Plus size={12} /> Sub-depósito
          </button>
        )}
        <button onClick={() => onAvaria(deposit)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 border border-red-200">
          <AlertTriangle size={12} /> Avaria
        </button>
        {isChild && (
          <button onClick={() => onTransfer({ type: 'devolucao', deposit })} className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs hover:bg-orange-100 border border-orange-200">
            <ArrowRightLeft size={12} /> Devolver
          </button>
        )}
        <button onClick={() => onBalance(deposit)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs hover:bg-green-100 border border-green-200">
          <ClipboardCheck size={12} /> Saldo
        </button>
        <button onClick={() => onMovements(deposit)} className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg text-xs hover:bg-sky-100 border border-sky-200">
          <Package size={12} /> Mov.
        </button>
        {canManage && (
          <button onClick={() => onEdit(deposit)} className="flex items-center gap-1 px-3 py-1.5 text-brand-600 rounded-lg text-xs hover:bg-brand-50 border border-brand-200">
            <Edit size={12} /> Editar
          </button>
        )}
        {canManage && (
          <button onClick={() => onDelete(deposit.id)} className="flex items-center gap-1 px-3 py-1.5 text-red-600 rounded-lg text-xs hover:bg-red-50 border border-red-200">
            <Trash2 size={12} /> Remover
          </button>
        )}
      </div>
    </div>
  );
}

function DepositEditor({ editing, form, deposits, setForm, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : form.parent_id ? 'Novo Sub-depósito' : 'Novo Depósito'}</h2>
        <form onSubmit={onSubmit} className="space-y-3">
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
                {deposits.filter(deposit => !deposit.parent_id).map(deposit => <option key={deposit.id} value={deposit.id}>{deposit.name}</option>)}
              </select>
            </div>
          )}
          {form.parent_id && (
            <p className="text-xs text-gray-400">Sub-depósito de: <strong>{deposits.find(deposit => String(deposit.id) === form.parent_id)?.name}</strong></p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
          </div>
        </form>
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

  const handleEdit = (deposit) => {
    setEditing(deposit);
    setForm({ name: deposit.name, description: deposit.description || '', address: deposit.address || '', parent_id: deposit.parent_id ? String(deposit.parent_id) : '' });
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

  const openAvaria = (deposit) => {
    setAvariaDeposit(deposit);
    setShowAvaria(true);
  };

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
          {parents.map(parent => (
            <div key={parent.id}>
              <DepositCard deposit={parent} canManage={canManage} onAddSub={handleAddSub}
                onTransfer={setTransferAction} onAvaria={openAvaria}
                onBalance={setBalanceDeposit} onMovements={setMovementsDeposit} onEdit={handleEdit} onDelete={handleDelete} />
              {childrenMap[parent.id] && childrenMap[parent.id].length > 0 && (
                <div className="mt-2 space-y-2">
                  {childrenMap[parent.id].map(child => <DepositCard key={child.id} deposit={child} isChild canManage={canManage} onAddSub={handleAddSub}
                    onTransfer={setTransferAction} onAvaria={openAvaria}
                    onBalance={setBalanceDeposit} onMovements={setMovementsDeposit} onEdit={handleEdit} onDelete={handleDelete} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <DepositEditor editing={editing} form={form} deposits={deposits}
        setForm={setForm} onSubmit={handleSubmit} onClose={() => setShowModal(false)} />}

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
