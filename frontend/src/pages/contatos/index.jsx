import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Plus, Search, Settings2 } from 'lucide-react';
import { formVazio, mapContatoToForm, buildContatoPayload } from './contato-form';
import { mapCnpjToForm, mapCepToForm } from './busca-externa';
import ContatoCard from './ContatoCard';
import ContatoForm from './ContatoForm';
import SeguimentosModal from './SeguimentosModal';

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
  const [form, setForm] = useState(formVazio());

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
    const payload = buildContatoPayload(form);
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
    setForm(mapContatoToForm(c));
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este contato?')) return;
    try { await api.delete(`/contacts/${id}`); loadContacts(); }
    catch (err) { alert(err.response?.data?.detail || 'Erro ao remover contato'); }
  };

  const resetForm = () => {
    setForm(formVazio());
  };

  const lookupCnpj = async () => {
    const cnpj = form.cpf_cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) { alert('Informe um CNPJ válido (14 dígitos)'); return; }
    setLookupLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const d = await res.json();
      setForm(f => mapCnpjToForm(d, f, normalize));
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
      setForm(f => mapCepToForm(d, f, normalize));
    } catch (err) {
      alert(err.message || 'Erro ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  };

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
          {canManage && (
            <button onClick={() => { resetForm(); setEditing(null); setShowModal(true); }}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
              <Plus size={18} /> Novo Contato
            </button>
          )}
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
          <ContatoCard key={c.id} contact={c}
            onEdit={canManage ? handleEdit : undefined}
            onDelete={canManage ? handleDelete : undefined} />
        ))}
      </div>

      {showModal && (
        <ContatoForm
          form={form}
          setForm={setForm}
          editing={editing}
          segments={segments}
          priceTables={priceTables}
          lookupLoading={lookupLoading}
          cepLoading={cepLoading}
          onLookupCnpj={lookupCnpj}
          onLookupCep={lookupCep}
          onSubmit={handleSubmit}
          onCancel={() => setShowModal(false)}
        />
      )}

      {showSegModal && (
        <SeguimentosModal
          segments={segments}
          newSegment={newSegment}
          setNewSegment={setNewSegment}
          editSegId={editSegId}
          setEditSegId={setEditSegId}
          editSegName={editSegName}
          setEditSegName={setEditSegName}
          onAdd={addSegment}
          onSaveEdit={saveSegmentEdit}
          onDelete={deleteSegment}
          onClose={() => setShowSegModal(false)}
        />
      )}
    </div>
  );
}
