import { useState } from 'react';
import { Plus, Pencil, Trash2, Landmark, Banknote, CreditCard, Smartphone } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { refresh } from '../lib/bus';
import { money, isoDay } from '../lib/format';
import { Page, Card, CountUp, Empty, Skeleton, FormModal, useToast, Badge, stagger } from '../components/ui';
import { motion } from 'framer-motion';

const TYPES = ['Savings Account', 'Current Account', 'Salary Account', 'Cash', 'Wallet', 'Credit Card', 'Investment Account', 'Other'];
const icon = (t) => (t === 'Cash' ? Banknote : t === 'Credit Card' ? CreditCard : t === 'Wallet' ? Smartphone : Landmark);

export default function Accounts() {
  const { data, loading } = useApi('/accounts');
  const [m, setM] = useState(null); // {} = new, obj = edit
  const toast = useToast();
  const total = (data || []).filter((a) => a.type !== 'Credit Card').reduce((s, a) => s + a.balance, 0);
  const fields = [
    { name: 'name', label: 'Account name', placeholder: 'HDFC Savings' }, { name: 'institution', label: 'Bank / institution' },
    { name: 'type', label: 'Type', type: 'select', options: TYPES }, { name: 'openingBalance', label: 'Opening balance (₹)', type: 'number' },
    { name: 'openingDate', label: 'Opening date', type: 'date' }, { name: 'last4', label: 'Last 4 digits (optional)', placeholder: '4417' },
  ];
  const save = async (v) => {
    if (m._id) await api.patch(`/accounts/${m._id}`, v); else await api.post('/accounts', v);
    toast.success('Account saved'); refresh();
  };
  const del = async (a) => { if (confirm(`Delete ${a.name}?`)) { await api.delete(`/accounts/${a._id}`); toast.success('Account deleted'); refresh(); } };
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white">Accounts</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Add your bank accounts, cash and cards with an opening balance. Balances update automatically from your transactions.</p><p className="num mt-1 text-sm text-slate-400">Total cash <span className="text-lg font-semibold text-white"><CountUp value={total} format={(v) => money(Math.round(v))} /></span></p></div>
        <button className="btn-primary" onClick={() => setM({})}><Plus size={16} />Add account</button>
      </div>
      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
        : !data.length ? <Card><Empty title="No accounts yet" hint="Add your first account to get started." action={<button className="btn-primary" onClick={() => setM({})}>Add account</button>} /></Card>
        : (<motion.div variants={stagger} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.map((a) => { const I = icon(a.type); return (
          <Card key={a._id} className="group">
            <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand-soft"><I size={20} /></span>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <button aria-label="Edit account" onClick={() => setM(a)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><Pencil size={15} /></button>
                <button aria-label="Delete account" onClick={() => del(a)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-loss/10 hover:text-loss"><Trash2 size={15} /></button></div></div>
            <p className="mt-4 font-medium text-white">{a.name}</p>
            <p className="text-xs text-slate-500">{a.institution || a.type}{a.last4 ? ` · •••• ${a.last4}` : ''}</p>
            <p className={`num mt-3 text-2xl font-semibold ${a.balance < 0 ? 'text-loss' : 'text-white'}`}><CountUp value={a.balance} format={(v) => money(Math.round(v))} /></p>
            <div className="mt-2"><Badge>{a.type}</Badge></div>
          </Card>); })}</motion.div>)}
      <FormModal open={!!m} onClose={() => setM(null)} title={m?._id ? 'Edit account' : 'Add account'} fields={fields}
        initial={m?._id ? { ...m, openingDate: isoDay(m.openingDate) } : { type: 'Savings Account', openingDate: isoDay() }} onSubmit={save} />
    </Page>
  );
}
