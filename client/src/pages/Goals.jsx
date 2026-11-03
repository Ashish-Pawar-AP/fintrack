import { useState } from 'react';
import { Plus, HandCoins, Trash2, Pause, Play } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { refresh } from '../lib/bus';
import { money, dt, isoDay } from '../lib/format';
import { Page, Card, Ring, Empty, Skeleton, Badge, FormModal, useToast } from '../components/ui';

const ST = { ON_TRACK: ['gain', 'On track'], AT_RISK: ['warn', 'At risk'], BEHIND: ['loss', 'Behind'], COMPLETED: ['brand', 'Completed'], PAUSED: ['mute', 'Paused'] };
const ringTone = { ON_TRACK: '#34D399', AT_RISK: '#FBBF24', BEHIND: '#F87171', COMPLETED: '#60A5FA', PAUSED: '#64748B' };
const CATS = ['Custom', 'Gaming PC', 'Emergency Fund', 'Car', 'Vacation', 'House', 'Education', 'Investment Corpus'];

export default function Goals() {
  const { data, loading } = useApi('/goals');
  const [add, setAdd] = useState(false), [contrib, setContrib] = useState(null);
  const toast = useToast();
  return (
    <Page>
      <div className="flex items-center justify-between"><div className="min-w-0"><h1 className="text-2xl font-bold text-white">Goals</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Save toward something specific. Set a target and date to see the monthly amount needed and whether you are on track.</p></div><button className="btn-primary" onClick={() => setAdd(true)}><Plus size={16} />New goal</button></div>
      {loading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
        : !data.length ? <Card><Empty title="No goals yet" hint="Create a goal and see the monthly saving needed to hit it." action={<button className="btn-primary" onClick={() => setAdd(true)}>New goal</button>} /></Card>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((g) => { const [tone, label] = ST[g.status]; return (
          <Card key={g._id}>
            <div className="flex items-start gap-4">
              <Ring value={g.progress} size={84} stroke={8} tone={ringTone[g.status]}>{Math.round(g.progress)}%</Ring>
              <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate font-semibold text-white">{g.name}</p><Badge tone={tone}>{label}</Badge></div>
                <p className="num mt-1 text-sm text-slate-300">{money(g.current)} <span className="text-slate-500">/ {money(g.target)}</span></p>
                <p className="text-xs text-slate-500">{g.targetDate ? `Target ${dt(g.targetDate)}` : 'No target date'}</p></div></div>
            <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-ink-950/50 p-3 text-center">
              {[['Remaining', money(g.remaining)], ['Needed / mo', g.required != null ? money(g.required) : '—'], ['Your pace', money(g.monthly)]].map(([k, v]) => <div key={k}><dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="num mt-0.5 text-xs font-medium text-white">{v}</dd></div>)}</dl>
            {g.shortfall > 0 && g.status !== 'PAUSED' && <p className="mt-2 text-xs text-warn">Shortfall of {money(g.shortfall)} per month</p>}
            <div className="mt-4 flex gap-2">
              <button className="btn-primary !min-h-[40px] flex-1" onClick={() => setContrib(g)}><HandCoins size={15} />Contribute</button>
              <button aria-label={g.paused ? 'Resume goal' : 'Pause goal'} className="btn-ghost !min-h-[40px] !px-3" onClick={async () => { await api.patch(`/goals/${g._id}`, { paused: !g.paused }); refresh(); }}>{g.paused ? <Play size={15} /> : <Pause size={15} />}</button>
              <button aria-label="Delete goal" className="btn-danger !min-h-[40px] !px-3" onClick={async () => { if (confirm('Delete this goal?')) { await api.delete(`/goals/${g._id}`); toast.success('Goal deleted'); refresh(); } }}><Trash2 size={15} /></button></div>
          </Card>); })}</div>}
      <FormModal open={add} onClose={() => setAdd(false)} title="New goal" initial={{ category: 'Custom' }}
        fields={[{ name: 'name', label: 'Goal name', placeholder: 'Gaming PC' }, { name: 'targetAmount', label: 'Target amount (₹)', type: 'number' }, { name: 'targetDate', label: 'Target date', type: 'date' },
          { name: 'priority', label: 'Priority', type: 'segment', options: ['LOW', 'MEDIUM', 'HIGH'] }, { name: 'category', label: 'Category', type: 'select', options: CATS }]}
        onSubmit={async (v) => { await api.post('/goals', v); toast.success('Goal created'); refresh(); }} />
      <FormModal open={!!contrib} onClose={() => setContrib(null)} title={`Contribute to ${contrib?.name || ''}`} initial={{ date: isoDay() }}
        fields={[{ name: 'amount', label: 'Amount (₹)', type: 'number' }, { name: 'date', label: 'Date', type: 'date' }, { name: 'note', label: 'Note' }]}
        onSubmit={async (v) => { await api.post(`/goals/${contrib._id}/contributions`, v); toast.success('Contribution added'); refresh(); }} />
    </Page>
  );
}
