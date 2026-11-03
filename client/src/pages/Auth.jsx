import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import { Landmark, ShieldCheck, ChartLine, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Field, ease, useToast } from '../components/ui';

function Shell({ title, sub, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-linear-to-br from-brand to-gain shadow-glow"><Landmark className="text-white" /></div><span className="text-xl font-bold text-white">FinTrack</span></div>
        <div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ease, duration: 0.8 }} className="grad-text text-5xl font-bold leading-tight">Every rupee,<br />accounted for.</motion.h1>
          <p className="mt-4 max-w-md text-slate-400">Track accounts, spending, SIPs and US stocks. You own the data — no bank access needed.</p>
          <div className="mt-10 space-y-4">
            {[[ShieldCheck, 'Private by design', 'Strict per-user isolation, hashed passwords, rotating sessions'], [ChartLine, 'Real P&L and XIRR', 'Mutual funds, SIPs and USD/INR-aware stock returns'], [Target, 'Goals that forecast', 'Know the monthly saving needed to hit your date']].map(([I, t, d], i) => (
              <motion.div key={t} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12, ease, duration: 0.6 }} className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-soft"><I size={18} /></div>
                <div><p className="font-medium text-white">{t}</p><p className="text-sm text-slate-400">{d}</p></div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-600">© FinTrack · A tracking tool, not financial advice.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ease, duration: 0.7 }} className="card w-full max-w-md p-8">
          <h2 className="text-2xl font-bold text-white">{title}</h2><p className="mb-6 mt-1 text-sm text-slate-400">{sub}</p>
          {children}<p className="mt-6 text-center text-sm text-slate-400">{footer}</p>
        </motion.div>
      </div>
    </div>
  );
}

function useAuthForm(fn, init) {
  const [v, setV] = useState(init), [err, setErr] = useState({}), [busy, setBusy] = useState(false), [top, setTop] = useState('');
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({}); setTop('');
    try { await fn(v); } catch (ex) { const d = ex.response?.data?.error; setErr(d?.fields || {}); setTop(d?.message || 'Could not reach the server.'); }
    finally { setBusy(false); }
  };
  return { v, set, err, busy, top, submit };
}

export function Login() {
  const { login } = useAuth();
  const f = useAuthForm(login, { email: '', password: '' });
  return (
    <Shell title="Welcome back" sub="Sign in to your financial workspace" footer={<>New here? <Link className="font-medium text-brand-soft hover:underline" to="/register">Create an account</Link></>}>
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <Field label="Email" error={f.err.email}><input className="input" type="email" autoComplete="email" value={f.v.email} onChange={f.set('email')} /></Field>
        <Field label="Password" error={f.err.password}><input className="input" type="password" autoComplete="current-password" value={f.v.password} onChange={f.set('password')} /></Field>
        <div className="text-right"><Link to="/forgot-password" className="text-sm text-brand-soft hover:underline">Forgot password?</Link></div>
        {f.top && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{f.top}</p>}
        <Button type="submit" loading={f.busy} className="w-full">Sign in</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const f = useAuthForm(async (v) => {
    if (v.password !== v.confirm) throw { response: { data: { error: { message: 'Passwords do not match', fields: { confirm: 'Does not match' } } } } };
    const { confirm, ...rest } = v;
    await register({ ...rest, country: 'IN', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  }, { name: '', email: '', password: '', confirm: '' });
  return (
    <Shell title="Create your workspace" sub="Start tracking in under a minute" footer={<>Already registered? <Link className="font-medium text-brand-soft hover:underline" to="/login">Sign in</Link></>}>
      <form onSubmit={f.submit} className="space-y-4" noValidate>
        <Field label="Name" error={f.err.name}><input className="input" autoComplete="name" value={f.v.name} onChange={f.set('name')} /></Field>
        <Field label="Email" error={f.err.email}><input className="input" type="email" autoComplete="email" value={f.v.email} onChange={f.set('email')} /></Field>
        <Field label="Password" error={f.err.password}><input className="input" type="password" autoComplete="new-password" value={f.v.password} onChange={f.set('password')} /></Field>
        <Field label="Confirm password" error={f.err.confirm}><input className="input" type="password" autoComplete="new-password" value={f.v.confirm} onChange={f.set('confirm')} /></Field>
        {f.top && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{f.top}</p>}
        <Button type="submit" loading={f.busy} className="w-full">Create account</Button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const f = useAuthForm(async (v) => { await api.post('/auth/forgot-password', { email: v.email }); setSent(true); }, { email: '' });
  return (
    <Shell title="Forgot your password?" sub="Enter your email and we will send you a reset link" footer={<Link className="font-medium text-brand-soft hover:underline" to="/login">Back to sign in</Link>}>
      {sent ? (
        <p role="status" className="rounded-lg border border-gain/30 bg-gain/10 px-3 py-3 text-sm text-gain">If that email is registered, a reset link is on its way. It expires in 30 minutes.</p>
      ) : (
        <form onSubmit={f.submit} className="space-y-4" noValidate>
          <Field label="Email" error={f.err.email}><input className="input" type="email" autoComplete="email" value={f.v.email} onChange={f.set('email')} /></Field>
          {f.top && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{f.top}</p>}
          <Button type="submit" loading={f.busy} className="w-full">Send reset link</Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [done, setDone] = useState(false);
  const f = useAuthForm(async (v) => {
    if (v.password !== v.confirm) throw { response: { data: { error: { message: 'Passwords do not match', fields: { confirm: 'Does not match' } } } } };
    await api.post('/auth/reset-password', { token, password: v.password });
    setDone(true);
  }, { password: '', confirm: '' });
  return (
    <Shell title="Choose a new password" sub="Pick something you have not used before" footer={<Link className="font-medium text-brand-soft hover:underline" to="/login">Back to sign in</Link>}>
      {done ? (
        <p role="status" className="rounded-lg border border-gain/30 bg-gain/10 px-3 py-3 text-sm text-gain">Password updated. All your devices were signed out. <Link className="font-medium underline" to="/login">Sign in</Link></p>
      ) : !token ? (
        <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-3 text-sm text-loss">This reset link is incomplete. Request a new one from the sign-in page.</p>
      ) : (
        <form onSubmit={f.submit} className="space-y-4" noValidate>
          <Field label="New password" error={f.err.password}><input className="input" type="password" autoComplete="new-password" value={f.v.password} onChange={f.set('password')} /></Field>
          <Field label="Confirm password" error={f.err.confirm}><input className="input" type="password" autoComplete="new-password" value={f.v.confirm} onChange={f.set('confirm')} /></Field>
          {f.top && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{f.top}</p>}
          <Button type="submit" loading={f.busy} className="w-full">Update password</Button>
        </form>
      )}
    </Shell>
  );
}
