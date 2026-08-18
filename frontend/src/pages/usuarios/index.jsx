import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { confirmar } from '../../utils/confirmar';
import { Plus, Users as UsersIcon } from 'lucide-react';
import TabelaDeUsuarios from './TabelaDeUsuarios';
import UsuarioForm from './UsuarioForm';
import { getEmptyForm, toPayload } from './usuario-form';
import { randPass } from './senha';

export default function Users() {
  const { notificar } = useNotificacao();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getEmptyForm());
  const [defaultRole, setDefaultRole] = useState('');
  const [loading, setLoading] = useState(false);

  const roleLabels = useMemo(() => {
    const labels = {};
    roles.forEach(r => { labels[r.name] = r.name + (r.is_admin ? ' (Admin)' : ''); });
    return labels;
  }, [roles]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/auth/users'),
      api.get('/roles/'),
      api.get('/deposits/'),
    ]).then(([u, r, d]) => {
      setUsers(u.data);
      setRoles(r.data);
      setDeposits(d.data);
      const defaultRoleName = r.data.find(role => role.is_default)?.name;
      if (defaultRoleName) setDefaultRole(current => current || defaultRoleName);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggleDeposit = (id) => {
    setForm(current => ({
      ...current,
      deposit_ids: current.deposit_ids.includes(id)
        ? current.deposit_ids.filter(depositId => depositId !== id)
        : [...current.deposit_ids, id],
    }));
  };

  const sorted = useMemo(() =>
    [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  [users]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const result = toPayload(form, Boolean(editing));
      if (!result.ok) {
        notificar.aviso(result.erro);
        return;
      }
      if (editing) await api.put(`/auth/users/${editing.id}`, result.data);
      else await api.post('/auth/register', result.data);
      setShowModal(false); setEditing(null); setForm(getEmptyForm(defaultRole)); load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao salvar usuário');
    }
  };

  const handleEdit = (user) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', confirmPassword: '', role: user.role, deposit_ids: user.deposit_ids || [] });
    setShowModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(getEmptyForm(defaultRole));
    setShowModal(true);
  };

  const handleGeneratePass = () => {
    const password = randPass();
    setForm(current => ({ ...current, password, confirmPassword: password }));
  };

  const handleDelete = async (id) => {
    if (!confirmar('Remover este usuário?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao remover usuário');
    }
  };

  const handleToggle = async (user) => {
    try {
      await api.put(`/auth/users/${user.id}`, { is_active: !user.is_active });
      load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao alterar status');
    }
  };

  if (loading && users.length === 0) return <div className="flex items-center justify-center h-64 text-gray-500">Carregando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <UsersIcon size={28} className="text-brand-600" />
          <h1 className="text-2xl font-bold">Usuários</h1>
        </div>
        <button onClick={openNew}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 text-sm">
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <TabelaDeUsuarios users={sorted} roleLabels={roleLabels}
        onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggle} />
      <UsuarioForm open={showModal} editing={editing} form={form} setForm={setForm} roles={roles}
        deposits={deposits} onSubmit={handleSubmit} onCancel={() => { setShowModal(false); setEditing(null); setForm(getEmptyForm(defaultRole)); }}
        onGeneratePass={handleGeneratePass} onToggleDeposit={toggleDeposit} />
    </div>
  );
}
