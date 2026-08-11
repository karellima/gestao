import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { CaseInput, CaseTextarea } from '../components/CaseInput';

export default function FinancialCategories() {
  const [allCategories, setAllCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({ name: '', description: '', type: 'despesa', parent_id: '' });

  const loadCategories = useCallback(() => {
    const params = filter ? { type: filter } : {};
    api.get('/financial-categories/all', { params }).then(res => setAllCategories(res.data));
  }, [filter]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const sortByName = (arr) => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const parents = useMemo(() => sortByName(allCategories.filter(c => !c.parent_id)), [allCategories]);
  const getSubcategories = (parentId) => sortByName(allCategories.filter(c => c.parent_id === parentId));

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, parent_id: form.parent_id ? parseInt(form.parent_id) : null };
      if (editing) { await api.put(`/financial-categories/${editing.id}`, data); }
      else { await api.post('/financial-categories/', data); }
      setShowModal(false); setEditing(null);
      setForm({ name: '', description: '', type: 'despesa', parent_id: '' }); loadCategories();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar categoria financeira');
    }
  };

  const handleEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', type: cat.type, parent_id: cat.parent_id || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta categoria?')) return;
    try { await api.delete(`/financial-categories/${id}`); loadCategories(); }
    catch (err) { alert(err.response?.data?.detail || 'Erro ao remover categoria financeira'); }
  };

  const renderCategory = (cat, level = 0) => {
    const subs = getSubcategories(cat.id);
    const isExpanded = expanded[cat.id];
    return (
      <div key={cat.id}>
        <div className={`flex items-center gap-2 p-3 border-b hover:bg-gray-50`} style={{ paddingLeft: `${12 + level * 24}px` }}>
          {subs.length > 0 ? (
            <button onClick={() => toggleExpand(cat.id)} className="text-gray-400 hover:text-gray-600">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : <div className="w-4" />}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${cat.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {cat.type === 'receita' ? 'Receita' : 'Despesa'}
          </span>
          <span className={level > 0 ? 'text-sm' : 'font-medium'}>{cat.name}</span>
          {subs.length > 0 && <span className="text-xs text-gray-400 ml-1">({subs.length})</span>}
          <div className="flex-1" />
          <button onClick={() => handleEdit(cat)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={14} /></button>
          <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:text-red-800"><Trash2 size={14} /></button>
        </div>
        {isExpanded && subs.map(sub => renderCategory(sub, level + 1))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categorias Financeiras</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', type: 'despesa', parent_id: '' }); setShowModal(true); }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Nova Categoria
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {[{ v: '', l: 'Todos' }, { v: 'receita', l: 'Receitas' }, { v: 'despesa', l: 'Despesas' }].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1 rounded-lg text-sm ${filter === f.v ? 'bg-brand-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {parents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma categoria cadastrada</div>
        ) : (
          parents.map(cat => renderCategory(cat))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nova'} Categoria Financeira</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </select>
                <select value={form.parent_id} onChange={e => setForm({...form, parent_id: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">Categoria pai</option>
                  {sortByName(parents.filter(c => c.type === form.type)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <CaseInput placeholder="Nome *" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required />
              <CaseTextarea placeholder="Descrição" value={form.description} rows={2}
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
