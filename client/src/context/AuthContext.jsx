import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, refreshSession } from '../lib/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    refreshSession().then((d) => setUser(d.user)).catch(() => {}).finally(() => setReady(true));
    const out = () => setUser(null);
    window.addEventListener('fintrack:logout', out);
    return () => window.removeEventListener('fintrack:logout', out);
  }, []);

  const authed = useCallback(async (path, body) => {
    const r = await api.post(path, body);
    setToken(r.data.data.accessToken); setUser(r.data.data.user);
  }, []);
  const value = {
    user, ready, setUser,
    login: (b) => authed('/auth/login', b),
    register: (b) => authed('/auth/register', b),
    logout: async () => { await api.post('/auth/logout').catch(() => {}); setToken(null); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
