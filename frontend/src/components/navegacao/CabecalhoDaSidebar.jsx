import { ChevronLeft, Menu, X } from 'lucide-react';

export default function CabecalhoDaSidebar({ isMobile, sidebarOpen, setSidebarOpen }) {
  return (
    <div className={`p-4 border-b border-brand-100 flex items-center ${!isMobile && !sidebarOpen ? 'justify-center' : 'justify-between'}`}>
      {(!isMobile && sidebarOpen) || isMobile ? (
        <div>
          <h1 className="text-lg font-bold text-brand-900">Sistema de Gestão</h1>
          <p className="text-xs text-brand-500 mt-1">Estoque, Vendas e Financeiro</p>
        </div>
      ) : null}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="text-brand-400 hover:text-brand-700 p-1 rounded"
        title={isMobile ? 'Fechar menu' : (sidebarOpen ? 'Recolher menu' : 'Expandir menu')}
      >
        {isMobile ? <X size={18} /> : (sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />)}
      </button>
    </div>
  );
}
