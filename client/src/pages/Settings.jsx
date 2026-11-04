import { useState } from 'react';
import { Download, LogOut, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Page, Card, Field, Button, useToast } from '../components/ui';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [form, setForm] = useState({ name: user.name, usdInr: user.usdInr });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.patch('/auth/me', form); setUser((u) => ({ ...u, ...r.data.data })); toast.success('Profile updated'); } catch { toast.error('Could not save. Please try again.'); } finally { setBusy(false); }
  };
  const download = async (path, name, type) => {
    const r = await api.get(path, { responseType: 'blob' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([r.data], { type })), download: name }); a.click(); URL.revokeObjectURL(a.href);
  };
  const backup = async () => {
    const [a, t, g, f, s] = await Promise.all(['/accounts', '/transactions?limit=100', '/goals', '/investments/funds', '/investments/stocks'].map((p) => api.get(p).then((r) => r.data.data)));
    const blob = new Blob([JSON.stringify({ exportedAt: new Date(), accounts: a, transactions: t.items, goals: g, funds: f, stocks: s }, null, 2)], { type: 'application/json' });
    const el = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'fintrack-backup.json' }); el.click(); URL.revokeObjectURL(el.href);
  };
  return (
    <Page className="max-w-2xl">
      <div className="min-w-0"><h1 className="text-2xl font-bold text-white">Settings</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Update your profile and USD/INR rate, download your data, and manage your security.</p></div>
      <Card><h3 className="mb-4 font-semibold text-white">Profile</h3>
        <form onSubmit={save} className="space-y-4">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input opacity-60" value={user.email} disabled /></Field>
          <Field label="USD/INR rate (used for US stocks)"><input className="input num" type="number" step="0.01" value={form.usdInr} onChange={(e) => setForm({ ...form, usdInr: e.target.value })} /></Field>
          <Button type="submit" loading={busy}>Save changes</Button></form></Card>
      <Card><h3 className="mb-1 font-semibold text-white">Data export</h3><p className="mb-4 text-sm text-slate-400">Your data is yours. Download it any time.</p>
        <div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => download('/transactions/export', 'transactions.csv', 'text/csv')}><Download size={16} />Transactions CSV</button>
          <button className="btn-ghost" onClick={backup}><Download size={16} />Full JSON backup</button></div></Card>
      <Card><h3 className="mb-1 flex items-center gap-2 font-semibold text-white"><ShieldCheck size={18} className="text-gain" />Security</h3>
        <p className="mb-4 text-sm text-slate-400">Sign out of every device if you think your session was exposed.</p>
        <button className="btn-danger" onClick={async () => { await api.post('/auth/logout-all'); logout(); }}><LogOut size={16} />Sign out everywhere</button></Card>
    </Page>
  );
}
