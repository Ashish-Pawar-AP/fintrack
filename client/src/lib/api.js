import axios from 'axios';
import { useEffect, useState } from 'react';
import { onRefresh } from './bus';

let token = null;
export const setToken = (t) => { token = t; };
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true });
api.interceptors.request.use((c) => { if (token) c.headers.Authorization = `Bearer ${token}`; return c; });

// Single-flight session refresh: every caller (app start, StrictMode double mount, parallel 401s) shares one request.
// Network / 5xx failures are retried; only a real 401 means "signed out".
let inflight = null;
export function refreshSession() {
  if (inflight) return inflight;
  inflight = (async () => {
    for (let i = 0; ; i++) {
      try {
        const r = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        setToken(r.data.data.accessToken);
        return r.data.data;
      } catch (e) {
        if (e.response?.status === 401 || i >= 2) throw e;
        await new Promise((res) => setTimeout(res, 600 * (i + 1)));
      }
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

api.interceptors.response.use((r) => r, async (err) => {
  const o = err.config;
  if (err.response?.status === 401 && o && !o._retry && !o.url.includes('/auth/')) {
    o._retry = true;
    try { await refreshSession(); return api(o); }
    catch (e) { if (e.response?.status === 401) { setToken(null); window.dispatchEvent(new Event('fintrack:logout')); } }
  }
  return Promise.reject(err);
});

export const errMsg = (e) => e?.response?.data?.error?.message || 'Something went wrong. Please try again.';

export function useApi(path, params, enabled = true) {
  const [s, set] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([path, params]);
  useEffect(() => onRefresh(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    api.get(path, { params }).then((r) => live && set({ data: r.data.data, loading: false, error: null }))
      .catch((e) => live && set((x) => ({ data: x.data, loading: false, error: e })));
    return () => { live = false; };
  }, [key, tick, enabled]); // eslint-disable-line
  return { ...s, loading: s.loading && !s.data, reload: () => setTick((t) => t + 1) };
}
