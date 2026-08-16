import {
  ArrowRightLeft,
  Banknote,
  BarChart3,
  Calculator,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  LayoutDashboard,
  Package,
  Ruler,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';

export const menuSections = [
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
