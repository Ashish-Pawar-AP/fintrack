import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { refresh } from '../lib/bus';
import { money, dt } from '../lib/format';
import { Page, Card, Empty, Skeleton, Badge, cn, useToast } from '../components/ui';
import QuickAdd from '../components/QuickAdd';
import { Select, DatePicker } from '../components/pickers';

const TYPES = [{ value: '', label: 'All types' }, ...['INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT', 'REFUND'].map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }))];
export default function Transactions() {
  const [f, setF] = useState({ search: '', type: '', from: '', to: '', page: 1 });
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  const params = Object.fromEntries(Object.entries({ ...f, limit: 15 }).filter(([, v]) => v !== ''));
  const { data, loading } = useApi('/transactions', params);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, page: 1 }));

  const del = async (t) => {
    if (!confirm('Delete this transaction? It can be recovered by support (soft delete).')) return;
    try { await api.delete(`/transactions/${t._id}`); toast.success('Transaction deleted'); refresh(); } catch { toast.error('Could not delete. Please try again.'); }
  };
  const exportCsv = async () => {
    const r = await api.get('/transactions/export', { params, responseType: 'blob' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(r.data), download: 'transactions.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  };
  const tone = (t) => (t.type === 'INCOME' || t.type === 'REFUND' || (t.type === 'INVESTMENT' && t.flow === 'in') ? 'gain' : t.type === 'TRANSFER' ? 'brand' : t.type === 'INVESTMENT' ? 'warn' : 'loss');

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-2xl font-bold text-white">Transactions</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Add your daily expenses and income, or move money between accounts. Search, filter and export everything you have logged.</p></div>
        <button onClick={exportCsv} className="btn-ghost"><Download size={16} />Export CSV</button></div>
      <Card className="!p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input aria-label="Search" placeholder="Search description, merchant…" className="input !pl-9" value={f.search} onChange={set('search')} /></div>
          <Select label="Type" value={f.type} onChange={(v) => setF((s) => ({ ...s, type: v, page: 1 }))} options={TYPES} />
          <DatePicker label="From date" placeholder="From date" clearable value={f.from} max={f.to || undefined} onChange={(v) => setF((s) => ({ ...s, from: v, page: 1 }))} />
          <DatePicker label="To date" placeholder="To date" clearable value={f.to} min={f.from || undefined} onChange={(v) => setF((s) => ({ ...s, to: v, page: 1 }))} />
        </div>
      </Card>
      <Card className="!p-0">
        {loading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : !data?.items.length ? <Empty title="No transactions found" hint="Use the + button to add your first income or expense." />
          : (<div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="border-b border-white/[0.07]"><tr>{['Date', 'Type', 'Category', 'Account', 'Amount', ''].map((h) => <th key={h} className={cn('th', h === 'Amount' && 'text-right')}>{h}</th>)}</tr></thead>
            <tbody><AnimatePresence initial>{data.items.map((t, i) => (
              <motion.tr key={t._id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.025, duration: 0.35 }} className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                <td className="td whitespace-nowrap text-slate-400">{dt(t.date)}</td>
                <td className="td"><Badge tone={tone(t)}>{t.type}</Badge></td>
                <td className="td"><p className="text-white">{t.description || '—'}</p><p className="text-xs text-slate-500">{t.category}{t.recurring ? ' · auto' : ''}</p></td>
                <td className="td text-slate-400">{t.account?.name}{t.toAccount ? ` → ${t.toAccount.name}` : ''}</td>
                <td className={cn('td num text-right font-medium', { gain: 'text-gain', loss: 'text-loss', brand: 'text-slate-200', warn: 'text-warn' }[tone(t)])}>{tone(t) === 'gain' ? '+' : tone(t) === 'loss' ? '−' : ''}{money(t.amount)}</td>
                <td className="td"><div className="flex justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                  <button aria-label="Edit" onClick={() => setEdit(t)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><Pencil size={15} /></button>
                  <button aria-label="Delete" onClick={() => del(t)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-loss/10 hover:text-loss"><Trash2 size={15} /></button></div></td>
              </motion.tr>))}</AnimatePresence></tbody></table></div>)}
        {data?.pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-sm text-slate-400">
            <span>{data.total} transactions</span>
            <div className="flex items-center gap-2">
              <button aria-label="Previous page" disabled={f.page <= 1} onClick={() => setF((s) => ({ ...s, page: s.page - 1 }))} className="btn-ghost !min-h-[36px] !px-2"><ChevronLeft size={16} /></button>
              <span className="num">{f.page} / {data.pages}</span>
              <button aria-label="Next page" disabled={f.page >= data.pages} onClick={() => setF((s) => ({ ...s, page: s.page + 1 }))} className="btn-ghost !min-h-[36px] !px-2"><ChevronRight size={16} /></button>
            </div></div>)}
      </Card>
      <QuickAdd edit={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}
