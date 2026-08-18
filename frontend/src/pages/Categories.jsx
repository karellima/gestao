import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { Plus } from 'lucide-react';
import { CaseInput, CaseTextarea } from '../components/CaseInput';
import CategoryTree from '../components/CategoryTree';
import { confirmar } from '../utils/confirmar';

export default function Categories() {
  const { notificar } = useNotificacao();
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({ name: '', description: '', parent_id: '' });

  const loadCategories = () => {
    api.get('/categories/all').then(res => {
      setAllCategories(res.data);
      const parents = res.data.filter(c => !c.parent_id);
      setCategories(parents);
    });
  };

  useEffect(() => { loadCategories(); }, []);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [categories]);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, parent_id: form.parent_id ? parseInt(form.parent_id) : null };
      if (editing) { await api.put(`/categories/${editing.id}`, data); }
      else { await api.post('/categories/', data); }
      setShowModal(false); setEditing(null); setForm({ name: '', description: '', parent_id: '' }); loadCategories();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao salvar categoria');
    }
  };

  const handleEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', parent_id: cat.parent_id || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirmar('Remover esta categoria?')) return;
    try { await api.delete(`/categories/${id}`); loadCategories(); }
    catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao remover categoria'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categorias e Subcategorias</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', parent_id: '' }); setShowModal(true); }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Nova Categoria
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {sortedCategories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma categoria cadastrada</div>
        ) : (
          <CategoryTree
            rootCategories={sortedCategories}
            allCategories={allCategories}
            expanded={expanded}
            onToggle={toggleExpand}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nova'} Categoria</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <CaseInput placeholder="Nome *" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
              <CaseTextarea placeholder="Descrição" value={form.description} rows={2}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <select value={form.parent_id} onChange={e => setForm({...form, parent_id: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Sem subcategoria (categoria pai)</option>
                {sortedCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
