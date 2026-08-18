import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import SortableHeader from '../components/SortableHeader';
import { CaseInput, CaseTextarea } from '../components/CaseInput';

export default function SaleTypes() {
  const { notificar } = useNotificacao();
  const [types, setTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [form, setForm] = useState({ name: '', description: '' });

  const load = () => api.get('/sale-types/').then(res => setTypes(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    const arr = [...types];
    arr.sort((a, b) => {
      let aVal = a[sortConfig.key] || '', bVal = b[sortConfig.key] || '';
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase(); }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return 1;
      return 0;
    });
    return arr;
  }, [types, sortConfig]);

  const handleSort = (key, direction) => setSortConfig({ key, direction });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/sale-types/${editing.id}`, form); }
      else { await api.post('/sale-types/', form); }
      setShowModal(false); setEditing(null); setForm({ name: '', description: '' }); load();
    } catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao salvar'); }
  };

  const handleEdit = (t) => { setEditing(t); setForm({ name: t.name, description: t.description || '' }); setShowModal(true); };
  const handleDelete = async (id) => {
    if (!confirm('Remover este tipo de lançamento?')) return;
    try { await api.delete(`/sale-types/${id}`); load(); } catch (err) { notificar.erro(err.response?.data?.detail || 'Erro'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tipos de Lançamento</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '' }); setShowModal(true); }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Novo Tipo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader label="Nome" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Descrição" sortKey="description" currentSort={sortConfig} onSort={handleSort} />
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium flex items-center gap-2">
                  <FileText size={16} className="text-brand-600" /> {t.name}
                </td>
                <td className="p-3 text-gray-500">{t.description || '-'}</td>
                <td className="p-3 text-center">
                  <button onClick={() => handleEdit(t)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-gray-500">Nenhum tipo cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Novo'} Tipo de Lançamento</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <CaseInput placeholder="Nome *" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
              <CaseTextarea placeholder="Descrição (opcional)" value={form.description} rows={3}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
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
