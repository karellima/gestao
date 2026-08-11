import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ArrowRightLeft,
  Banknote,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Ruler,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  UserCog,
  Users,
  Warehouse,
  X,
} from 'lucide-react';

const menuSections = [
  {
    label: 'Cadastros',
    items: [{ path: '/contacts', label: 'Clientes/Fornecedores', icon: Users }],
  },
  {
    label: 'Estoque',
    items: [
      { path: '/deposits', label: 'Depósitos', icon: Warehouse },
      { path: '/products', label: 'Produtos', icon: Package },
      { path: '/stock-reports', label: 'Relatórios', icon: BarChart3 },
      { path: '/requisicoes', label: 'Requisições', icon: ClipboardList },
      { path: '/pricing', label: 'Precificação', icon: Calculator },
      { path: '/categories', label: 'Categorias', icon: Tag },
      { path: '/units', label: 'Unidades', icon: Ruler },
      { path: '/stock', label: 'Movimentações', icon: ArrowRightLeft },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { path: '/accounts', label: 'Contas/Cartões', icon: CreditCard },
      { path: '/financial', label: 'Lançamentos', icon: DollarSign },
      { path: '/financial-categories', label: 'Categorias', icon: Tag },
      { path: '/payment-types', label: 'Tipos de Pagamento', icon: Banknote },
      { path: '/recurrence-frequencies', label: 'Frequências', icon: Clock },
      { path: '/financial-reports', label: 'Relatórios', icon: FileText },
    ],
  },
  {
    label: 'Vendas',
    items: [
      { path: '/price-tables', label: 'Tabela de Preços', icon: Tag },
      { path: '/sale-types', label: 'Tipos de Lançamento', icon: FileText },
      { path: '/sales', label: 'Lançamentos', icon: ShoppingCart },
    ],
  },
  {
    label: 'Geral',
    items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Configuração',
    items: [
      { path: '/users', label: 'Usuários', icon: UserCog },
      { path: '/roles', label: 'Perfis de Acesso', icon: Shield },
      { path: '/settings', label: 'Configuração de texto', icon: Settings },
    ],
  },
];

export const MODULE_MAP = {
  '/contacts': 'contacts',
  '/deposits': 'deposits',
  '/products': 'products',
  '/stock-reports': 'stock_reports',
  '/requisicoes': 'requisicoes',
  '/pricing': 'precificacao',
  '/categories': 'categories',
  '/units': 'units',
  '/stock': 'stock_movements',
  '/accounts': 'accounts',
  '/financial': 'financial',
  '/financial-categories': 'financial_categories',
  '/payment-types': 'payment_types',
  '/recurrence-frequencies': 'recurrence_frequencies',
  '/financial-reports': 'financial_reports',
  '/sale-types': 'sale_types',
  '/sales': 'sales',
  '/price-tables': 'price_tables',
  '/': 'dashboard',
  '/users': 'users',
  '/roles': 'roles',
  '/settings': 'settings',
};

export const DEFAULT_ROUTE_ORDER = [
  '/', '/contacts', '/deposits', '/products', '/stock-reports', '/requisicoes',
  '/pricing', '/categories', '/units', '/stock', '/accounts', '/financial',
  '/financial-categories', '/payment-types', '/recurrence-frequencies',
  '/financial-reports', '/sale-types', '/price-tables', '/sales', '/users', '/roles',
  '/settings',
];

export default function NavigationSidebar({
  user,
  permissions,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  onLogout,
}) {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (label) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className={`${isMobile
      ? `fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
      : `${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300`
    } bg-gradient-to-b from-white to-brand-50 text-brand-900 border-r border-brand-100 flex flex-col overflow-y-auto`}>
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
      <nav className="flex-1 p-2">
        {menuSections.map((section) => {
          const visibleItems = section.items.filter(item => {
            const module = MODULE_MAP[item.path];
            return !module || !permissions || permissions[module];
          });
          if (visibleItems.length === 0 && section.label !== 'Geral') return null;
          return (
            <div key={section.label} className="mb-2">
              {sidebarOpen ? (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-medium text-brand-900 hover:bg-brand-100 hover:text-brand-700 transition-colors"
                >
                  {section.label}
                  {expandedSections[section.label] ? <ChevronRight size={14} className="text-brand-400" /> : <ChevronDown size={14} className="text-brand-400" />}
                </button>
              ) : (
                <div className="px-3 py-1.5 text-xs font-semibold text-brand-400 text-center mb-1" title={section.label}>
                  {section.label.charAt(0)}
                </div>
              )}
              {sidebarOpen && !expandedSections[section.label] && visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
                      isActive ? 'bg-gradient-to-b from-brand-600 to-brand-700 text-white' : 'text-brand-800 hover:bg-brand-100 hover:text-brand-900'
                    }`
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
              {!sidebarOpen && visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={item.label}
                  className={({ isActive }) =>
                    `flex items-center justify-center px-3 py-2 rounded-lg mb-0.5 transition-colors ${
                      isActive ? 'bg-gradient-to-b from-brand-600 to-brand-700 text-white' : 'text-brand-800 hover:bg-brand-100 hover:text-brand-900'
                    }`
                  }
                >
                  <item.icon size={18} />
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className={`p-4 border-t border-brand-100 ${sidebarOpen ? '' : 'flex justify-center'}`}>
        {sidebarOpen && <div className="text-sm font-semibold text-brand-900 mb-2">{user?.name}</div>}
        {!sidebarOpen && <div className="text-xs text-brand-500 mb-2 text-center" title={user?.name}>{user?.name?.charAt(0)?.toUpperCase()}</div>}
        <button onClick={onLogout} className={`flex items-center gap-2 text-sm text-brand-400 hover:text-brand-700 hover:bg-brand-100 rounded-lg px-2 py-1.5 ${!sidebarOpen ? 'justify-center' : ''}`} title="Sair">
          <LogOut size={16} />
          {sidebarOpen && 'Sair'}
        </button>
      </div>
    </aside>
  );
}
