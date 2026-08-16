import { Users as UsersIcon } from 'lucide-react';
import { CaseInput } from '../../components/CaseInput';
import SelecaoDeDepositos from './SelecaoDeDepositos';
import UsuarioCamposSenha from './UsuarioCamposSenha';
import SelecaoDePerfil from './SelecaoDePerfil';

export default function UsuarioForm({
  open, editing, form, setForm, roles, deposits, onSubmit, onCancel, onGeneratePass, onToggleDeposit,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-100 text-brand-600">
            <UsersIcon size={20} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{editing ? 'Editar' : 'Novo'} Usuário</h2>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
              <CaseInput placeholder="Nome completo" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
              <input type="email" placeholder="email@exemplo.com" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" required />
            </div>
            <UsuarioCamposSenha editing={editing} form={form} setForm={setForm} onGeneratePass={onGeneratePass} />
            <SelecaoDePerfil roles={roles} value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
            <SelecaoDeDepositos deposits={deposits} depositIds={form.deposit_ids} onToggle={onToggleDeposit} />
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onCancel}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm">
              {editing ? 'Atualizar' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
