import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import InactivityWarning from './InactivityWarning';
import InstallPrompt from './InstallPrompt';
import ConnectionStatus from './ConnectionStatus';
import NavigationSidebar from './NavigationSidebar';

export { DEFAULT_ROUTE_ORDER, MODULE_MAP } from './NavigationSidebar';

const INACTIVITY_MS = 25 * 60 * 1000;
const WARNING_SECONDS = 120;

export default function Layout() {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(max-width: 768px)').matches ? false : true);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      setSidebarOpen(!e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const warningTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const resetInactivityTimer = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowWarning(false);
    setCountdown(WARNING_SECONDS);
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARNING_SECONDS);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            logout();
            navigate('/login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_MS);
  }, [logout, navigate]);

  const handleStayLoggedIn = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handler = () => resetInactivityTimer();
    events.forEach(ev => window.addEventListener(ev, handler));
    resetInactivityTimer();
    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetInactivityTimer]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isPrintRoute = location.pathname.includes('/print');

  if (isPrintRoute) {
    return (
      <div className="h-screen bg-white">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-brand-50">
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}
      <NavigationSidebar
        user={user}
        permissions={permissions}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto bg-brand-50">
        {isMobile && (
          <div className="sticky top-0 z-20 bg-gradient-to-b from-white to-brand-50 text-brand-900 border-b border-brand-100 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-700" title="Abrir menu">
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold truncate text-brand-900">Sistema de Gestão</span>
          </div>
        )}
        <ConnectionStatus />
        <div className="p-4 md:p-6"><Outlet /></div>
      </main>
      <InactivityWarning
        show={showWarning}
        countdown={countdown}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogout}
      />
      <InstallPrompt />
    </div>
  );
}
