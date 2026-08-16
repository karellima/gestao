export default function SelecaoDePerfil({ roles, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Perfil *</label>
      <select value={value} onChange={onChange}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" required>
        <option value="">Selecione</option>
        {roles.map(r => (
          <option key={r.id} value={r.name}>{r.name}{r.is_admin ? ' (Admin)' : ''}{r.is_default ? ' (padrão)' : ''}</option>
        ))}
      </select>
    </div>
  );
}
