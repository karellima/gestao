import { KeyRound } from 'lucide-react';

export default function UsuarioCamposSenha({ editing, form, setForm, onGeneratePass }) {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-500">
            {editing ? 'Nova senha' : 'Senha *'}
          </label>
          {editing && (
            <button type="button" onClick={onGeneratePass}
              className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1">
              <KeyRound size={12} /> Gerar senha
            </button>
          )}
        </div>
        <input type="text" placeholder={editing ? 'Deixe vazio para manter a atual' : 'Mínimo 6 caracteres'} value={form.password}
          onChange={e => setForm({...form, password: e.target.value})}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          required={!editing} minLength={editing ? 0 : 6} />
      </div>
      {form.password && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar senha</label>
          <input type="text" placeholder="Repita a senha" value={form.confirmPassword}
            onChange={e => setForm({...form, confirmPassword: e.target.value})}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
      )}
    </>
  );
}
