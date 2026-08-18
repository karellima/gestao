import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { Shield, Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { CaseInput } from '../components/CaseInput';
import { confirmar } from '../utils/confirmar';

const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { section: 'Cadastros', items: [
    { key: 'contacts', label: 'Clientes/Fornecedores' },
  ]},
  { section: 'Estoque', items: [
    { key: 'deposits', label: 'Depósitos (operações)' },
    { key: 'deposits_manage', label: 'Depósitos (gerenciar)' },
    { key: 'products', label: 'Produtos' },
    { key: 'stock_reports', label: 'Relatórios Estoque' },
    { key: 'requisicoes', label: 'Requisições' },
    { key: 'precificacao', label: 'Precificação' },
    { key: 'categories', label: 'Categorias' },
    { key: 'units', label: 'Unidades' },
    { key: 'stock_movements', label: 'Movimentações' },
  ]},
  { section: 'Financeiro', items: [
    { key: 'accounts', label: 'Contas/Cartões' },
    { key: 'financial', label: 'Lançamentos' },
    { key: 'financial_categories', label: 'Categorias' },
    { key: 'payment_types', label: 'Tipos Pagamento' },
    { key: 'recurrence_frequencies', label: 'Frequências' },
    { key: 'financial_reports', label: 'Relatórios' },
  ]},
  { section: 'Vendas', items: [
    { key: 'sale_types', label: 'Tipos Lançamento' },
    { key: 'sales', label: 'Lançamentos' },
  ]},
  { section: 'Geral', items: [
    { key: 'users', label: 'Usuários' },
    { key: 'roles', label: 'Perfis de Acesso' },
    { key: 'settings', label: 'Configuração' },
  ]},
];

const ACCESS_LEVELS = [
  { value: 'view', label: 'Exibir' },
  { value: 'edit', label: 'Editar' },
];

export default function Roles() {
  const { notificar } = useNotificacao();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', is_admin: false, modules: {} });

  const load = () => {
    setLoading(true);
    api.get('/roles/').then(res => setRoles(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const flatMods = useMemo(() => ALL_MODULES.flatMap(m => m.items || [m]), []);

  const openNew = () => {
    const m = {};
    flatMods.forEach(mod => { m[mod.key] = 'edit'; });
    setForm({ name: '', is_admin: false, modules: m });
    setModal('new');
  };

  const openEdit = (r) => {
    const m = {};
    flatMods.forEach(mod => {
      const found = r.modules.find(p => p.module === mod.key);
      m[mod.key] = found ? found.access_level : null;
    });
    setForm({ name: r.name, is_admin: r.is_admin, modules: m });
    setModal(r);
  };

  const toggleModule = (key) => {
    setForm(f => ({
      ...f,
      modules: { ...f.modules, [key]: f.modules[key] ? null : 'edit' },
    }));
  };

  const setAccess = (key, level) => {
    setForm(f => ({ ...f, modules: { ...f.modules, [key]: level } }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notificar.aviso('Nome do perfil é obrigatório'); return; }
    const modules = Object.entries(form.modules)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ module: k, access_level: v }));
    try {
      if (modal === 'new') {
        await api.post('/roles/', { name: form.name, is_admin: form.is_admin, modules });
      } else {
        await api.put(`/roles/${modal.id}`, { name: form.name, is_admin: form.is_admin, modules });
      }
      setModal(null);
      load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleDelete = async (r) => {
    if (!confirmar(`Remover perfil "${r.name}"?`)) return;
    try {
      await api.delete(`/roles/${r.id}`);
      load();
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao remover');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-50"><Shield size={20} className="text-purple-600" /></div>
          <h1 className="text-xl font-bold">Perfis de Acesso</h1>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 shadow-sm">
          <Plus size={16} /> Novo Perfil
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-12">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${r.is_admin ? 'bg-purple-100' : 'bg-gray-100'}`}>
                    <Shield size={18} className={r.is_admin ? 'text-purple-600' : 'text-gray-500'} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{r.name}</h3>
                    {r.is_admin && <span className="text-xs text-purple-600 font-medium">Acesso total</span>}
                    {r.is_default && <span className="text-xs text-gray-400 ml-2">(padrão)</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit size={15} /></button>
                  <button onClick={() => handleDelete(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="px-5 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {flatMods.map(mod => {
                    const perm = r.modules.find(p => p.module === mod.key);
                    const active = !!perm || r.is_admin;
                    const level = perm?.access_level;
                    return (
                      <span key={mod.key} className={`text-xs px-2 py-1 rounded-full border ${
                        r.is_admin ? 'bg-purple-50 text-purple-600 border-purple-200'
                        : active && level === 'edit' ? 'bg-green-50 text-green-700 border-green-200'
                        : active && level === 'view' ? 'bg-brand-50 text-brand-600 border-brand-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}>
                        {mod.label}{active && level === 'view' ? ' (ver)' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-purple-600" />
                <h2 className="text-lg font-bold">{modal === 'new' ? 'Novo Perfil' : 'Editar Perfil'}</h2>
              </div>
              <button onClick={() => setModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Perfil</label>
                <CaseInput value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm" placeholder="Ex: Gerente" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_admin} onChange={e => setForm({...form, is_admin: e.target.checked})}
                  className="rounded" />
                <span className="text-sm font-medium">Acesso total (administrador)</span>
              </label>
              {!form.is_admin && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Módulos</label>
                  <div className="space-y-3">
                    {ALL_MODULES.map(s => s.items ? (
                      <div key={s.section}>
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5 px-1">{s.section}</p>
                        <div className="space-y-1">
                          {s.items.map(mod => (
                            <div key={mod.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-sm font-medium">{mod.label}</span>
                              <div className="flex items-center gap-2">
                                {form.modules[mod.key] && (
                                  <select value={form.modules[mod.key]} onChange={e => setAccess(mod.key, e.target.value)}
                                    className="text-xs border rounded px-2 py-1">
                                    {ACCESS_LEVELS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                  </select>
                                )}
                                <button onClick={() => toggleModule(mod.key)}
                                  className={`text-xs px-3 py-1 rounded-full border ${
                                    form.modules[mod.key]
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-gray-100 text-gray-400 border-gray-200'
                                  }`}>
                                  {form.modules[mod.key] ? 'Ativo' : 'Inativo'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div key={s.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm font-medium">{s.label}</span>
                        <div className="flex items-center gap-2">
                          {form.modules[s.key] && (
                            <select value={form.modules[s.key]} onChange={e => setAccess(s.key, e.target.value)}
                              className="text-xs border rounded px-2 py-1">
                              {ACCESS_LEVELS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                          )}
                          <button onClick={() => toggleModule(s.key)}
                            className={`text-xs px-3 py-1 rounded-full border ${
                              form.modules[s.key]
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                            }`}>
                            {form.modules[s.key] ? 'Ativo' : 'Inativo'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setModal(null)} className="px-5 py-2.5 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 shadow-sm">
                <Save size={15} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
