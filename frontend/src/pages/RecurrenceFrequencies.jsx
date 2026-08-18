import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { CaseInput } from '../components/CaseInput';

export default function RecurrenceFrequencies() {
  const { notificar } = useNotificacao();
  const [frequencies, setFrequencies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', days_interval: '' });

  const load = () => api.get('/recurrence-frequencies/').then(res => setFrequencies(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() =>
    [...frequencies].sort((a, b) => a.days_interval - b.days_interval),
    [frequencies]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, days_interval: parseInt(form.days_interval) };
      if (editing) { await api.put(`/recurrence-frequencies/${editing.id}`, data); }
      else { await api.post('/recurrence-frequencies/', data); }
      setShowModal(false); setEditing(null); setForm({ name: '', days_interval: '' }); load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao salvar frequência');
    }
  };

  const handleEdit = (f) => {
    setEditing(f);
    setForm({ name: f.name, days_interval: f.days_interval });
    setShowModal(true);
  };

  const handleToggle = async (f) => {
    try {
      await api.put(`/recurrence-frequencies/${f.id}`, { is_active: !f.is_active });
      load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao alterar status');
    }
  };

  const formatInterval = (days) => {
    if (days === 1) return '1 dia';
    if (days < 30) return `${days} dias`;
    if (days === 30) return '1 mês';
    if (days < 365) return `${Math.round(days / 30)} meses`;
    return `${Math.round(days / 365)} ano(s)`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Frequências de Recorrência</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', days_interval: '' }); setShowModal(true); }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Nova Frequência
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-center p-3">Intervalo</th>
              <th className="text-center p-3">Dias</th>
              <th className="text-center p-3">Status</th>
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(f => (
              <tr key={f.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium flex items-center gap-2">
                  <Clock size={14} className="text-gray-400" />
                  {f.name}
                </td>
                <td className="p-3 text-center text-gray-500">{formatInterval(f.days_interval)}</td>
                <td className="p-3 text-center font-mono text-gray-600">{f.days_interval}</td>
                <td className="p-3 text-center">
                  {f.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle size={12} /> Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      <XCircle size={12} /> Inativo
                    </span>
                  )}
                </td>
                <td className="p-3 text-center whitespace-nowrap">
                  <button onClick={() => handleEdit(f)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
                  <button onClick={() => handleToggle(f)}
                    className={f.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nova'} Frequência</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                <CaseInput placeholder="Ex: Quinzenal, Bimestral..." value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Intervalo em Dias *</label>
                <input type="number" min="1" max="3650" placeholder="Ex: 15, 30, 60..." value={form.days_interval}
                  onChange={e => setForm({...form, days_interval: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
                <p className="text-xs text-gray-400 mt-1">
                  {form.days_interval && formatInterval(parseInt(form.days_interval))}
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
