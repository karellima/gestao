import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { useAuth } from '../../contexts/AuthContext';
import ContaCard from './ContaCard';
import ContaForm from './ContaForm';
import { fromAccount, getEmptyForm, toPayload } from './conta-form';

const filters = [
  { v: '', l: 'Todas' }, { v: 'banco', l: 'Bancos' },
  { v: 'caixa', l: 'Caixa' }, { v: 'cartao_credito', l: 'Cartões' },
];

export default function Accounts() {
  const { notificar } = useNotificacao();
  const { permissions } = useAuth();
  const canManage = permissions?.['accounts'] === 'edit';
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getEmptyForm());

  const load = useCallback(() => {
    const params = filter ? { account_type: filter } : {};
    api.get('/accounts/', { params }).then(res => setAccounts(res.data)).catch(() => {});
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [accounts],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const data = toPayload(form);
      if (editing) await api.put(`/accounts/${editing.id}`, data);
      else await api.post('/accounts/', data);
      setShowModal(false); setEditing(null); setForm(getEmptyForm()); load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao salvar conta');
    }
  };

  const handleEdit = (account) => {
    setEditing(account);
    setForm(fromAccount(account));
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover?')) return;
    try { await api.delete(`/accounts/${id}`); load(); }
    catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao remover conta'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Contas e Cartões de Crédito</h1>
        {canManage && (
          <button onClick={() => { setEditing(null); setForm(getEmptyForm()); setShowModal(true); }}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
            <Plus size={18} /> Nova Conta
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {filters.map(item => (
          <button key={item.v} onClick={() => setFilter(item.v)}
            className={`px-3 py-1 rounded-lg text-sm ${filter === item.v ? 'bg-brand-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {item.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedAccounts.map(account => (
          <ContaCard key={account.id} account={account} canManage={canManage}
            onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>

      <ContaForm open={showModal} editing={editing} form={form} setForm={setForm}
        onSubmit={handleSubmit} onCancel={() => setShowModal(false)} />
    </div>
  );
}
