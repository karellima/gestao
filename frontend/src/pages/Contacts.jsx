import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { CaseInput, CaseTextarea } from '../components/CaseInput';
import { Plus, Edit, Trash2, Search, User, Building, Settings2, Check, X } from 'lucide-react';

export default function Contacts() {
  const { permissions } = useAuth();
  const { normalize } = useSettings();
  const canManage = permissions?.['contacts'] === 'edit';
  const [contacts, setContacts] = useState([]);
  const [segments, setSegments] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [priceTables, setPriceTables] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [showSegModal, setShowSegModal] = useState(false);
  const [newSegment, setNewSegment] = useState('');
  const [editSegId, setEditSegId] = useState(null);
  const [editSegName, setEditSegName] = useState('');
  const [form, setForm] = useState({
    name: '', contact_type: 'cliente', cpf_cnpj: '', segment: '', email: '',
    phone: '', address: '', cep: '', city: '', state: '', notes: '', price_table_id: '',
  });

  const loadContacts = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (filter) params.contact_type = filter;
    api.get('/contacts/', { params }).then(res => setContacts(res.data)).catch(() => {});
  }, [search, filter]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  useEffect(() => {
    api.get('/price-tables/').then(res => setPriceTables(res.data)).catch(() => {});
  }, []);

  const loadSegments = useCallback(() => {
    api.get('/contact-segments/').then(res => setSegments(res.data)).catch(() => {});
  }, []);

  useEffect(() => { loadSegments(); }, [loadSegments]);

  const addSegment = async () => {
    const name = newSegment.trim();
    if (!name) { alert('Informe um nome para o seguimento'); return; }
    try {
      await api.post('/contact-segments/', { name });
      setNewSegment('');
      loadSegments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao adicionar seguimento');
    }
  };

  const saveSegmentEdit = async (id) => {
    const name = editSegName.trim();
    if (!name) return;
    try {
      await api.put(`/contact-segments/${id}`, { name });
      setEditSegId(null);
      loadSegments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar seguimento');
    }
  };

  const deleteSegment = async (id) => {
    if (!confirm('Remover este seguimento?')) return;
    try {
      await api.delete(`/contact-segments/${id}`);
      loadSegments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao remover seguimento');
    }
  };

  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [contacts]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      price_table_id: form.price_table_id ? parseInt(form.price_table_id) : null,
    };
    try {
      if (editing) { await api.put(`/contacts/${editing.id}`, payload); }
      else { await api.post('/contacts/', payload); }
      setShowModal(false); setEditing(null); resetForm(); loadContacts();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar contato');
    }
  };

  const handleEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name, contact_type: c.contact_type, cpf_cnpj: c.cpf_cnpj || '', segment: c.segment || '',
      email: c.email || '', phone: c.phone || '', address: c.address || '',
      cep: c.cep || '', city: c.city || '', state: c.state || '', notes: c.notes || '',
      price_table_id: c.price_table_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este contato?')) return;
    try { await api.delete(`/contacts/${id}`); loadContacts(); }
    catch (err) { alert(err.response?.data?.detail || 'Erro ao remover contato'); }
  };

  const resetForm = () => {
    setForm({ name: '', contact_type: 'cliente', cpf_cnpj: '', segment: '', email: '', phone: '', address: '', cep: '', city: '', state: '', notes: '', price_table_id: '' });
  };

  const fmtPhone = (v) => {
    const digits = String(v || '').replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return digits;
  };

  const lookupCnpj = async () => {
    const cnpj = form.cpf_cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) { alert('Informe um CNPJ válido (14 dígitos)'); return; }
    setLookupLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const d = await res.json();
      const address = [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', ');
      setForm(f => ({
        ...f,
        name: normalize((d.nome_fantasia || '').trim() || (d.razao_social || '').trim()),
        email: d.email || f.email,
        phone: fmtPhone(d.ddd_telefone_1) || f.phone,
        address: (address || f.address) && (address ? normalize([address, d.bairro].filter(Boolean).join(' - ')) : f.address),
        cep: d.cep ? d.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : f.cep,
        city: d.municipio ? normalize(d.municipio) : f.city,
        state: d.uf || f.state,
      }));
    } catch (err) {
      alert(err.message || 'Erro ao buscar CNPJ');
    } finally {
      setLookupLoading(false);
    }
  };

  const lookupCep = async () => {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) { alert('Informe um CEP válido (8 dígitos)'); return; }
    setCepLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (!res.ok) throw new Error('CEP não encontrado');
      const d = await res.json();
      setForm(f => ({
        ...f,
        address: f.address ? f.address : normalize([d.street, d.neighborhood].filter(Boolean).join(' - ')),
        city: d.city ? normalize(d.city) : f.city,
        state: d.state || f.state,
      }));
    } catch (err) {
      alert(err.message || 'Erro ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const typeLabels = { cliente: 'Cliente', fornecedor: 'Fornecedor', both: 'Cliente/Fornecedor' };
  const typeColors = { cliente: 'bg-brand-100 text-brand-700', fornecedor: 'bg-purple-100 text-purple-700', both: 'bg-teal-100 text-teal-700' };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clientes e Fornecedores</h1>
        <div className="flex gap-2">
          {canManage && (
            <button onClick={() => setShowSegModal(true)}
              className="px-4 py-2 rounded-lg border flex items-center gap-2 hover:bg-gray-50">
              <Settings2 size={18} /> Seguimentos
            </button>
          )}
          <button onClick={() => { resetForm(); setEditing(null); setShowModal(true); }}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
            <Plus size={18} /> Novo Contato
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[{ v: '', l: 'Todos' }, { v: 'cliente', l: 'Clientes' }, { v: 'fornecedor', l: 'Fornecedores' }].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1 rounded-lg text-sm ${filter === f.v ? 'bg-brand-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input type="text" placeholder="Buscar contato..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="flex-1 outline-none text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedContacts.map(c => (
          <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                {c.contact_type === 'fornecedor' ? <Building size={20} className="text-purple-600" /> : <User size={20} className="text-brand-600" />}
                <span className="font-semibold">{c.name}</span>
                {c.segment && <span className="text-xs text-gray-400">· {c.segment}</span>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[c.contact_type]}`}>
                {typeLabels[c.contact_type]}
              </span>
            </div>
            <div className="space-y-1 text-sm text-gray-600 mb-3">
              {c.cpf_cnpj && <div>{c.cpf_cnpj}</div>}
              {c.email && <div>{c.email}</div>}
              {c.phone && <div>{c.phone}</div>}
              {c.city && c.state && <div>{c.city} - {c.state}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => handleEdit(c)} className="text-brand-600 hover:text-brand-800"><Edit size={16} /></button>
              <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Novo'} Contato</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <CaseInput placeholder="Nome *" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="col-span-2 px-3 py-2 border rounded-lg text-sm" required />
                <select value={form.contact_type} onChange={e => setForm({...form, contact_type: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="cliente">Cliente</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="both">Cliente/Fornecedor</option>
                </select>
                <div className="flex gap-1">
                  <input placeholder="CPF/CNPJ" value={form.cpf_cnpj}
                    onChange={e => setForm({...form, cpf_cnpj: e.target.value})}
                    className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm" />
                  {form.cpf_cnpj.replace(/\D/g, '').length === 14 && (
                    <button type="button" onClick={lookupCnpj} title="Buscar dados pelo CNPJ"
                      className="px-3 py-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200">
                      {lookupLoading ? '...' : <Search size={16} />}
                    </button>
                  )}
                </div>
                <select value={form.segment} onChange={e => setForm({...form, segment: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">Seguimento...</option>
                  {segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <CaseInput placeholder="Email" type="email" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <div className="flex gap-1">
                  <input placeholder="Telefone" value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="flex gap-1">
                  <input placeholder="CEP" inputMode="numeric" value={form.cep}
                    onChange={e => setForm({...form, cep: e.target.value})}
                    className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm" />
                  {form.cep.replace(/\D/g, '').length === 8 && (
                    <button type="button" onClick={lookupCep} title="Buscar endereço pelo CEP"
                      className="px-3 py-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200">
                      {cepLoading ? '...' : <Search size={16} />}
                    </button>
                  )}
                </div>
                <CaseInput placeholder="Endereço" value={form.address}
                  onChange={e => setForm({...form, address: e.target.value})}
                  className="col-span-2 px-3 py-2 border rounded-lg text-sm" />
                <CaseInput placeholder="Cidade" value={form.city}
                  onChange={e => setForm({...form, city: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="UF" maxLength={2} value={form.state}
                  onChange={e => setForm({...form, state: e.target.value.toUpperCase()})}
                  className="px-3 py-2 border rounded-lg text-sm" />
                <select value={form.price_table_id} onChange={e => setForm({...form, price_table_id: e.target.value})}
                  className="col-span-2 px-3 py-2 border rounded-lg text-sm">
                  <option value="">Sem tabela de preços</option>
                  {priceTables.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <CaseTextarea placeholder="Observações" value={form.notes} rows={2}
                onChange={e => setForm({...form, notes: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSegModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Seguimentos</h2>
              <button onClick={() => setShowSegModal(false)} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <CaseInput placeholder="Novo seguimento..." value={newSegment}
                onChange={e => setNewSegment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSegment(); } }}
                className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              <button onClick={addSegment} className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Adicionar</button>
            </div>
            <ul className="space-y-2">
              {segments.map(s => (
                <li key={s.id} className="flex items-center gap-2">
                  {editSegId === s.id ? (
                    <>
                      <CaseInput value={editSegName} onChange={e => setEditSegName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveSegmentEdit(s.id); } }}
                        className="flex-1 px-2 py-1 border rounded-lg text-sm" autoFocus />
                      <button onClick={() => saveSegmentEdit(s.id)} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                      <button onClick={() => setEditSegId(null)} className="text-gray-500 hover:text-gray-700"><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{s.name}</span>
                      <button onClick={() => { setEditSegId(s.id); setEditSegName(s.name); }} className="text-brand-600 hover:text-brand-800"><Edit size={16} /></button>
                      <button onClick={() => deleteSegment(s.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
