import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotificacaoProvider } from './contexts/NotificacaoContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Financial from './pages/Financial';
import Contacts from './pages/Contacts';
import Categories from './pages/Categories';
import FinancialCategories from './pages/FinancialCategories';
import Deposits from './pages/Deposits';
import Accounts from './pages/Accounts';
import PaymentTypes from './pages/PaymentTypes';
import Units from './pages/Units';
import StockReports from './pages/StockReports';
import Users from './pages/Users';
import Roles from './pages/Roles';
import RecurrenceFrequencies from './pages/RecurrenceFrequencies';
import FinancialReports from './pages/FinancialReports';
import SaleTypes from './pages/SaleTypes';
import PriceTables from './pages/PriceTables';
import SalesList from './pages/SalesList';
import SaleNew from './pages/SaleNew';
import SaleDetail from './pages/SaleDetail';
import SalePrint from './pages/SalePrint';
import Requisicoes from './pages/Requisicoes';
import TransferReport from './pages/TransferReport';
import Pricing from './pages/Pricing';
import SettingsPage from './pages/Settings';
import Layout, { MODULE_MAP, DEFAULT_ROUTE_ORDER } from './components/Layout';

function Home() {
  const { permissions } = useAuth();
  if (!permissions || permissions['dashboard']) {
    return <Dashboard />;
  }
  const target = DEFAULT_ROUTE_ORDER.find(p => p !== '/' && permissions[MODULE_MAP[p]]);
  return <Navigate to={target || '/'} replace />;
}

function PrivateRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <NotificacaoProvider>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/stock-reports" element={<StockReports />} />
              <Route path="/deposits" element={<Deposits />} />
              <Route path="/requisicoes" element={<Requisicoes />} />
              <Route path="/transfer-report" element={<TransferReport />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/financial-categories" element={<FinancialCategories />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/payment-types" element={<PaymentTypes />} />
              <Route path="/units" element={<Units />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/users" element={<Users />} />
              <Route path="/roles" element={<Roles />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/recurrence-frequencies" element={<RecurrenceFrequencies />} />
              <Route path="/financial-reports" element={<FinancialReports />} />
              <Route path="/sale-types" element={<SaleTypes />} />
              <Route path="/price-tables" element={<PriceTables />} />
              <Route path="/sales" element={<SalesList />} />
              <Route path="/sales/new" element={<SaleNew />} />
              <Route path="/sales/:id" element={<SaleDetail />} />
              <Route path="/sales/:id/print" element={<SalePrint />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </NotificacaoProvider>
  );
}

export default App;
