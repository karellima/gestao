import { LogOut } from 'lucide-react';

export default function RodapeDaSidebar({ user, sidebarOpen, onLogout }) {
  return (
    <div className={`p-4 border-t border-brand-100 ${sidebarOpen ? '' : 'flex justify-center'}`}>
      {sidebarOpen && <div className="text-sm font-semibold text-brand-900 mb-2">{user?.name}</div>}
      {!sidebarOpen && <div className="text-xs text-brand-500 mb-2 text-center" title={user?.name}>{user?.name?.charAt(0)?.toUpperCase()}</div>}
      <button onClick={onLogout} className={`flex items-center gap-2 text-sm text-brand-400 hover:text-brand-700 hover:bg-brand-100 rounded-lg px-2 py-1.5 ${!sidebarOpen ? 'justify-center' : ''}`} title="Sair">
        <LogOut size={16} />
        {sidebarOpen && 'Sair'}
      </button>
    </div>
  );
}
