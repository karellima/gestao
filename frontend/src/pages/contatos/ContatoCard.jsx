import { Edit, Trash2, User, Building } from 'lucide-react';

const typeLabels = { cliente: 'Cliente', fornecedor: 'Fornecedor', both: 'Cliente/Fornecedor' };
const typeColors = { cliente: 'bg-brand-100 text-brand-700', fornecedor: 'bg-purple-100 text-purple-700', both: 'bg-teal-100 text-teal-700' };

export default function ContatoCard({ contact, canManage, onEdit, onDelete }) {
  const c = contact;
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
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
      {canManage && (
        <div className="flex justify-end gap-2">
          <button onClick={() => onEdit(c)} className="text-brand-600 hover:text-brand-800"><Edit size={16} /></button>
          <button onClick={() => onDelete(c.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
        </div>
      )}
    </div>
  );
}
