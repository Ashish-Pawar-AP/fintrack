import { useState } from 'react';
import { Plus, Trash2, TriangleAlert } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { refresh } from '../lib/bus';
import { money, monthKey } from '../lib/format';
import { MonthPicker } from '../components/pickers';
import { Page, Card, Empty, Skeleton, Progress, FormModal, useToast, cn } from '../components/ui';

export default function Budgets() {
  const [month, setMonth] = useState(monthKey());
  const { data, loading } = useApi('/budgets', { month });
  const { data: cats } = useApi('/categories');
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-2xl font-bold text-white">Budgets</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Set a monthly limit for each spending category and see how much of it you have used.</p></div>
        <div className="flex gap-2"><MonthPicker value={month} onChange={setMonth} className="w-52" />
          <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />Set budget</button></div></div>
      {loading ? <Skeleton className="h-60" /> : !data.length ? <Card><Empty title="No budgets for this month" hint="Set a limit for categories like Food or Shopping." action={<button className="btn-primary" onClick={() => setOpen(true)}>Set budget</button>} /></Card>
        : <div className="grid gap-4 md:grid-cols-2">{data.map((b) => { const over = b.pct > 100, warn = b.pct > 80; return (
          <Card key={b._id}>
            <div className="flex items-start justify-between"><div><p className="font-medium text-white">{b.category}</p>
              <p className="num text-sm text-slate-400">{money(b.spent)} of {money(b.budget)}</p></div>
              <button aria-label="Remove budget" onClick={async () => { await api.delete(`/budgets/${b._id}`); toast.success('Budget removed'); refresh(); }} className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-loss/10 hover:text-loss"><Trash2 size={15} /></button></div>
            <Progress value={b.pct} tone={over ? 'loss' : warn ? 'warn' : 'gain'} className="mt-4" />
            <p className={cn('num mt-2 flex items-center gap-1.5 text-sm font-medium', over ? 'text-loss' : warn ? 'text-warn' : 'text-gain')}>
              {(over || warn) && <TriangleAlert size={14} />}{Math.round(b.pct)}% used{over ? ` · overspent ${money(b.spent - b.budget)}` : warn ? ' · nearing limit' : ` · ${money(b.budget - b.spent)} left`}</p>
          </Card>); })}</div>}
      <FormModal open={open} onClose={() => setOpen(false)} title="Set monthly budget" initial={{ month }}
        fields={[{ name: 'category', label: 'Category', type: 'select', options: cats?.EXPENSE || [] }, { name: 'amount', label: 'Budget (₹)', type: 'number' }, { name: 'month', label: 'Month', type: 'month' }]}
        onSubmit={async (v) => { await api.put('/budgets', v); toast.success('Budget saved'); refresh(); }} />
    </Page>
  );
}
