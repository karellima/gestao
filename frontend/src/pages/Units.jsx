import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { Plus, Edit, Trash2, Ruler } from 'lucide-react';
import SortableHeader from '../components/SortableHeader';
import { CaseInput } from '../components/CaseInput';
import { confirmar } from '../utils/confirmar';

export default function Units() {
  const { notificar } = useNotificacao();
  const [units, setUnits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [form, setForm] = useState({ name: '', abbreviation: '' });

  const load = () => api.get('/units/').then(res => setUnits(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const sortedUnits = useMemo(() => {
    const arr = [...units];
    arr.sort((a, b) => {
      let aVal = a[sortConfig.key] || '';
      let bVal = b[sortConfig.key] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [units, sortConfig]);

  const handleSort = (key, direction) => setSortConfig({ key, direction });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/units/${editing.id}`, form); }
      else { await api.post('/units/', form); }
      setShowModal(false); setEditing(null); setForm({ name: '', abbreviation: '' }); load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao salvar unidade');
    }
  };

  const handleEdit = (u) => { setEditing(u); setForm({ name: u.name, abbreviation: u.abbreviation }); setShowModal(true); };
  const handleDelete = async (id) => {
    if (!confirmar('Remover esta unidade?')) return;
    try { await api.delete(`/units/${id}`); load(); }
    catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao remover unidade'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Unidades de Medida</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', abbreviation: '' }); setShowModal(true); }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Nova Unidade
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader label="Nome" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Abreviação" sortKey="abbreviation" currentSort={sortConfig} onSort={handleSort} />
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedUnits.map(u => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium flex items-center gap-2">
                  <Ruler size={16} className="text-gray-400" /> {u.name}
                </td>
                <td className="p-3 text-gray-500">{u.abbreviation}</td>
                <td className="p-3 text-center">
                  <button onClick={() => handleEdit(u)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {sortedUnits.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-gray-500">Nenhuma unidade cadastrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nova'} Unidade</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <CaseInput placeholder="Nome (ex: Quilograma)" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
              <input placeholder="Abreviação (ex: kg)" value={form.abbreviation}
                onChange={e => setForm({...form, abbreviation: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
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
