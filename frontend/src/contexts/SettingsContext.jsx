import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { normalizeCase } from '../services/caseText';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [dataCase, setDataCase] = useState('title');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    api.get('/settings/')
      .then(res => { if (active) setDataCase(res.data.data_entry_case || 'title'); })
      .catch(() => { /* sem acesso: mantém o padrão */ });
    return () => { active = false; };
  }, [user?.id]);

  const saveDataCase = async (value) => {
    setLoading(true);
    try {
      const res = await api.put('/settings/', { data_entry_case: value });
      setDataCase(res.data.data_entry_case);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const normalize = useCallback((value) => normalizeCase(value, dataCase), [dataCase]);

  return (
    <SettingsContext.Provider value={{ dataCase, setDataCase, saveDataCase, normalize, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings deve ser usado dentro de SettingsProvider');
  return ctx;
};
