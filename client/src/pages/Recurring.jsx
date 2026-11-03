import { useState } from 'react';
import { Plus, Pause, Play, Trash2, Zap } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { refresh } from '../lib/bus';
import { money, dt, isoDay } from '../lib/format';
import { Page, Card, Empty, Skeleton, Badge, FormModal, useToast, cn } from '../components/ui';

export default function Recurring() {
  const { data, loading } = useApi('/recurring');
  const { data: accounts } = useApi('/accounts');
  const { data: cats } = useApi('/categories');
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const fields = (v) => [
    { name: 'type', label: 'Type', type: 'segment', options: ['EXPENSE', 'INCOME'] },
    { name: 'description', label: 'Name', placeholder: 'Rent, Netflix, Salary…' }, { name: 'amount', label: 'Amount (₹)', type: 'number' },
    { name: 'category', label: 'Category', type: 'select', options: cats?.[v.type] || [] },
    { name: 'account', label: 'Account', type: 'select', options: (accounts || []).map((a) => ({ value: a._id, label: a.name })) },
    { name: 'frequency', label: 'Frequency', type: 'select', options: ['MONTHLY', 'WEEKLY', 'YEARLY'] }, { name: 'startDate', label: 'First date', type: 'date' },
  ];
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); refresh(); } catch { toast.error('Action failed. Please try again.'); } };
  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-2xl font-bold text-white">Recurring</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Set up rent, bills, subscriptions or salary that repeat. They are added automatically on their due date.</p></div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => act(async () => { const r = await api.post('/recurring/run'); toast.success(`${r.data.data.created} due transactions created`); }, 'Checked for due items')}><Zap size={16} />Run due now</button>
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />New rule</button></div></div>
      {loading ? <Skeleton className="h-60" /> : !data.length ? <Card><Empty title="No recurring transactions" hint="Rent, subscriptions and salary can be generated automatically." action={<button className="btn-primary" onClick={() => setOpen(true)}>New rule</button>} /></Card>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((r) => (
          <Card key={r._id}>
            <div className="flex items-start justify-between"><div><p className="font-medium text-white">{r.description}</p><p className="text-xs text-slate-500">{r.category} · {r.frequency.toLowerCase()}</p></div>
              <Badge tone={r.status === 'ACTIVE' ? 'gain' : r.status === 'PAUSED' ? 'warn' : 'mute'}>{r.status}</Badge></div>
            <p className={cn('num mt-4 text-2xl font-semibold', r.type === 'INCOME' ? 'text-gain' : 'text-white')}>{r.type === 'INCOME' ? '+' : '−'}{money(r.amount)}</p>
            <p className="mt-1 text-xs text-slate-400">Next: {dt(r.nextOccurrence)}</p>
            <div className="mt-4 flex gap-2">
              {r.status === 'ACTIVE' ? <button className="btn-ghost !min-h-[40px] flex-1" onClick={() => act(() => api.patch(`/recurring/${r._id}`, { status: 'PAUSED' }), 'Paused')}><Pause size={14} />Pause</button>
                : r.status === 'PAUSED' && <button className="btn-ghost !min-h-[40px] flex-1" onClick={() => act(() => api.patch(`/recurring/${r._id}`, { status: 'ACTIVE' }), 'Resumed')}><Play size={14} />Resume</button>}
              <button aria-label="Delete rule" className="btn-danger !min-h-[40px] !px-3" onClick={() => confirm('Delete this rule?') && act(() => api.delete(`/recurring/${r._id}`), 'Deleted')}><Trash2 size={14} /></button></div>
          </Card>))}</div>}
      <FormModal open={open} onClose={() => setOpen(false)} title="New recurring rule" fields={fields} initial={{ type: 'EXPENSE', frequency: 'MONTHLY', startDate: isoDay() }}
        onSubmit={async (v) => { await api.post('/recurring', v); toast.success('Rule created'); refresh(); }} />
    </Page>
  );
}
