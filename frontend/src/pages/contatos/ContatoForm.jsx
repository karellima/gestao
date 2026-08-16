import { Search } from 'lucide-react';
import { CaseInput, CaseTextarea } from '../../components/CaseInput';

export default function ContatoForm({
  form, setForm, editing, segments, priceTables,
  lookupLoading, cepLoading, onLookupCnpj, onLookupCep, onSubmit, onCancel,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Novo'} Contato</h2>
        <form onSubmit={onSubmit} className="space-y-3">
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
                <button type="button" onClick={onLookupCnpj} title="Buscar dados pelo CNPJ"
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
                <button type="button" onClick={onLookupCep} title="Buscar endereço pelo CEP"
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
            <button type="button" onClick={onCancel}
              className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            <button type="submit"
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
