import { Edit, Trash2, Shield, User, Lock } from 'lucide-react';

export default function TabelaDeUsuarios({ users, roleLabels, onEdit, onDelete, onToggle }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Nome</th>
            <th className="text-left p-3">Email</th>
            <th className="text-center p-3">Perfil</th>
            <th className="text-center p-3">Senha</th>
            <th className="text-center p-3">Status</th>
            <th className="text-center p-3">Criado em</th>
            <th className="text-center p-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t hover:bg-gray-50">
              <td className="p-3 font-medium flex items-center gap-2">
                {u.role === 'admin' ? <Shield size={14} className="text-purple-500" /> : <User size={14} className="text-gray-400" />}
                {u.name}
              </td>
              <td className="p-3 text-gray-500">{u.email}</td>
              <td className="p-3 text-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                  {roleLabels[u.role] || u.role}
                </span>
              </td>
              <td className="p-3 text-center">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${u.has_password !== false ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  <Lock size={12} />
                  {u.has_password !== false ? 'Definida' : 'Pendente'}
                </span>
              </td>
              <td className="p-3 text-center">
                <button onClick={() => onToggle(u)}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${u.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                  {u.is_active ? 'Ativo' : 'Inativo'}
                </button>
              </td>
              <td className="p-3 text-center text-gray-400 text-xs">
                {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-'}
              </td>
              <td className="p-3 text-center whitespace-nowrap">
                <button onClick={() => onEdit(u)} className="text-brand-600 hover:text-brand-800 mr-2" title="Editar"><Edit size={16} /></button>
                <button onClick={() => onDelete(u.id)} className="text-red-600 hover:text-red-800" title="Remover"><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={7} className="p-6 text-center text-gray-400">Nenhum usuário cadastrado</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
