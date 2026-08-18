import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { configureApiErrorHandler } from '../services/api';
import Notificacao from '../components/Notificacao';

const NotificacaoContext = createContext(null);

export function NotificacaoProvider({ children }) {
  const [notificacoes, setNotificacoes] = useState([]);

  const adicionar = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotificacoes(current => [...current, { id, type, message }]);
    return id;
  }, []);

  const fechar = useCallback((id) => {
    setNotificacoes(current => current.filter(item => item.id !== id));
  }, []);

  const notificar = useMemo(() => ({
    erro: message => adicionar('erro', message),
    sucesso: message => adicionar('sucesso', message),
    aviso: message => adicionar('aviso', message),
  }), [adicionar]);

  useEffect(() => {
    configureApiErrorHandler(({ type, message }) => adicionar(type, message));
    return () => configureApiErrorHandler(null);
  }, [adicionar]);

  return (
    <NotificacaoContext.Provider value={{ notificar }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex w-full max-w-md flex-col gap-3" aria-live="polite">
        {notificacoes.map(item => (
          <Notificacao key={item.id} {...item} onClose={() => fechar(item.id)} />
        ))}
      </div>
    </NotificacaoContext.Provider>
  );
}

export function useNotificacao() {
  const context = useContext(NotificacaoContext);
  if (!context) throw new Error('useNotificacao deve ser usado dentro de NotificacaoProvider');
  return context;
}
