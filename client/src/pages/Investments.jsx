import { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, RefreshCw, Play, Pause, Zap, Trash2, Repeat, CalendarClock, Layers, Pencil } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { refresh } from '../lib/bus';
import { money, pct, dt, isoDay } from '../lib/format';
import { Page, Card, CountUp, Empty, Skeleton, Badge, FormModal, useToast, cn, Progress } from '../components/ui';

const TABS = ['Overview', 'Mutual Funds', 'SIPs', 'Indian Stocks', 'US Stocks'];
const PL = ({ v, p, cur }) => <span className={cn('num font-medium', v >= 0 ? 'text-gain' : 'text-loss')}>{v >= 0 ? '▲ +' : '▼ '}{money(Math.abs(v), cur)}{p != null && ` (${pct(p)})`}</span>;
const Stat = ({ label, children }) => <div><p className="text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="num mt-1 text-xl font-semibold text-white">{children}</p></div>;
const Calc = ({ children }) => <p className="num rounded-xl border border-white/[0.07] bg-ink-950/50 px-3 py-2.5 text-sm text-slate-300">{children}</p>;

export default function Investments() {
  const [tab, setTab] = useState('Overview');
  return (
    <Page>
      <div><h1 className="text-2xl font-bold text-white">Investments</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Track mutual funds, Indian and US stocks and SIPs in one place. Add what you already hold using units and today's price, and see your profit, loss and returns.</p></div>
      <div role="tablist" className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('relative min-h-[40px] shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors sm:px-4', tab === t ? 'text-white' : 'text-slate-400 hover:text-white')}>
              {tab === t && <motion.span layoutId="invtab" className="absolute inset-0 rounded-lg bg-brand/25 ring-1 ring-brand/40" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative">{t}</span>
            </button>))}
        </div>
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
        {tab === 'Overview' && <Overview />}
        {tab === 'Mutual Funds' && <Funds />}
        {tab === 'SIPs' && <Sips />}
        {tab === 'Indian Stocks' && <Stocks market="IN" />}
        {tab === 'US Stocks' && <Stocks market="US" />}
      </motion.div>
    </Page>
  );
}

function Overview() {
  const { data: s, loading } = useApi('/investments/summary');
  if (loading) return <Skeleton className="h-72" />;
  const parts = [{ name: 'Mutual funds', value: s.mf.current, c: '#3B82F6' }, { name: 'Indian stocks', value: s.in.current, c: '#FBBF24' }, { name: 'US stocks', value: s.us.currentInr, c: '#34D399' }].filter((p) => p.value > 0);
  if (!parts.length) return <Card><Empty title="No investments tracked" hint="Add what you already hold — units and current NAV — or start a SIP." /></Card>;
  const tot = s.total.current;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Invested"><CountUp value={s.total.invested} format={(v) => money(Math.round(v))} /></Stat>
          <Stat label="Current"><CountUp value={tot} format={(v) => money(Math.round(v))} /></Stat>
          <Stat label="Total P&L"><PL v={s.total.pnl} /></Stat>
          <Stat label="Return">{pct(s.total.pct)}</Stat>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[['Mutual funds', money(s.mf.current), <PL key="a" v={s.mf.pnl} p={s.mf.pct} />, s.mf.xirr != null && <Badge key="b" tone="brand">XIRR {s.mf.xirr}%</Badge>],
            ['Indian stocks', money(s.in.current), <PL key="a" v={s.in.pnl} p={s.in.pct} />],
            ['US stocks', money(s.us.current, 'USD'), <PL key="a" v={s.us.pnl} p={s.us.pct} cur="USD" />, <Badge key="b">₹{s.usdInr}/USD</Badge>]].map(([t, v, p, b]) => (
            <div key={t} className="rounded-xl border border-white/[0.07] bg-ink-950/40 p-4"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium text-white">{t}</span>{b}</div><p className="num text-lg text-white">{v}</p>{p}</div>))}
        </div>
      </Card>
      <Card><h3 className="font-semibold text-white">Allocation</h3>
        <div className="h-44"><ResponsiveContainer><PieChart><Pie data={parts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={4} stroke="none" animationDuration={1200}>{parts.map((p) => <Cell key={p.name} fill={p.c} />)}</Pie><Tooltip formatter={(v) => money(v)} contentStyle={{ background: '#131C33', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }} /></PieChart></ResponsiveContainer></div>
        {parts.map((p) => <div key={p.name} className="mb-2"><div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-2 text-slate-300"><i className="h-2.5 w-2.5 rounded-full" style={{ background: p.c }} />{p.name}</span><span className="num text-slate-400">{((p.value / tot) * 100).toFixed(1)}%</span></div><Progress value={(p.value / tot) * 100} /></div>)}
      </Card>
    </div>
  );
}

// ---------------- Mutual funds: one-off holdings (SIP instalments are included automatically)
function Funds() {
  const { data, loading } = useApi('/investments/funds');
  const { data: accounts } = useApi('/accounts');
  const [m, setM] = useState(null);
  const toast = useToast();
  if (loading) return <Skeleton className="h-72" />;
  const holdings = data.holdings.filter((h) => h.units > 0 || h.cost > 0);
  return (<>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm text-slate-400"><Layers size={16} className="text-brand-soft" />Your holdings. SIP instalments appear here automatically.</p>
      <button className="btn-primary" onClick={() => setM('holding')}><Plus size={16} />Add current holding</button>
    </div>
    {!holdings.length ? <Card><Empty title="No mutual funds yet" hint="Enter the units you hold and today's NAV — we calculate the current value." action={<button className="btn-primary" onClick={() => setM('holding')}>Add current holding</button>} /></Card> : (<>
      <Card><div className="grid grid-cols-2 gap-6 sm:grid-cols-4"><Stat label="Invested">{money(data.summary.invested)}</Stat><Stat label="Current value">{money(data.summary.current)}</Stat><Stat label="P&L"><PL v={data.summary.pnl} p={data.summary.pct} /></Stat><Stat label="XIRR">{data.summary.xirr != null ? `${data.summary.xirr}%` : '—'}</Stat></div></Card>
      <div className="grid gap-4 md:grid-cols-2">{holdings.map((h) => (
        <Card key={h.fund._id}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold text-white">{h.fund.name}</p><p className="text-xs text-slate-500">{[h.fund.amc, h.fund.folio && `Folio ${h.fund.folio}`].filter(Boolean).join(' · ')}</p></div>{h.xirr != null && <Badge tone="brand">XIRR {h.xirr}%</Badge>}</div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {[['Units', h.units.toFixed(3)], ['Current NAV', `₹${h.nav}`], ['Invested', money(h.cost)], ['Current value', money(h.current)]].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="num text-white">{v}</dd></div>)}</dl>
          <div className="mt-3 border-t border-white/[0.06] pt-3"><PL v={h.unrealized} p={h.pct} /></div>
          <p className="mt-1 text-[11px] text-slate-500">NAV as of {dt(h.fund.navDate)}</p>
          <div className="mt-3 flex gap-2"><button className="btn-ghost !min-h-[40px] flex-1" onClick={() => setM({ buy: h.fund })}>Buy / Sell</button><button className="btn-primary !min-h-[40px] flex-1" onClick={() => setM({ nav: h.fund })}><RefreshCw size={14} />NAV</button><button aria-label="Edit holding" title="Edit" className="btn-ghost !min-h-[40px] !px-3" onClick={() => setM({ edit: h })}><Pencil size={14} /></button><button aria-label="Delete holding" title="Delete" className="btn-danger !min-h-[40px] !px-3" onClick={async () => { if (confirm(`Delete ${h.fund.name} and all its entries? Cash transactions already recorded stay.`)) { try { await api.delete(`/investments/funds/${h.fund._id}`); toast.success('Holding deleted'); refresh(); } catch (e) { toast.error(e.response?.data?.error?.message || 'Could not delete.'); } } }}><Trash2 size={14} /></button></div>
        </Card>))}</div></>)}

    <FormModal open={m === 'holding'} onClose={() => setM(null)} title="Add current mutual fund holding" initial={{}}
      fields={[{ name: 'name', label: 'Fund name', placeholder: 'HDFC Flexi Cap' }, { name: 'units', label: 'Units you hold', type: 'number' }, { name: 'nav', label: 'Current NAV (₹)', type: 'number' },
        { name: 'invested', label: 'Total amount invested (₹, optional)', type: 'number' }, { name: 'amc', label: 'AMC (optional)' }, { name: 'folio', label: 'Folio (optional)' }, { name: 'date', label: 'Holding since (optional)', type: 'date', clearable: true, max: isoDay() }]}
      footer={(v) => { const val = (+v.units || 0) * (+v.nav || 0), inv = +v.invested || val; return (<Calc>Current value = {money(val)}{v.invested ? <> · P&L {val >= inv ? '+' : '−'}{money(Math.abs(val - inv))}</> : <span className="text-slate-500"> · leave invested blank to start P&L at 0</span>}</Calc>); }}
      onSubmit={async (v) => { await api.post('/investments/funds/holding', v); toast.success('Holding added'); refresh(); }} submitLabel="Add holding" />
    <FormModal open={!!m?.edit} onClose={() => setM(null)} title={`Edit · ${m?.edit?.fund?.name || ''}`} submitLabel="Save changes"
      initial={m?.edit ? { name: m.edit.fund.name, amc: m.edit.fund.amc || '', folio: m.edit.fund.folio || '', units: m.edit.units, nav: m.edit.nav, invested: m.edit.cost } : {}}
      fields={[{ name: 'name', label: 'Fund name' }, { name: 'units', label: 'Units you hold', type: 'number' }, { name: 'nav', label: 'Current NAV (₹)', type: 'number' }, { name: 'invested', label: 'Total amount invested (₹)', type: 'number' }, { name: 'amc', label: 'AMC' }, { name: 'folio', label: 'Folio' }]}
      footer={(v) => { const val = (+v.units || 0) * (+v.nav || 0), inv = +v.invested || 0; return <Calc>Current value = {money(val)} · P&L {val >= inv ? '+' : '−'}{money(Math.abs(val - inv))}</Calc>; }}
      onSubmit={async (v) => { await api.patch(`/investments/funds/${m.edit.fund._id}/holding`, v); toast.success('Holding updated'); refresh(); }} />
    <FormModal open={!!m?.nav} onClose={() => setM(null)} title={`Update NAV · ${m?.nav?.name || ''}`} fields={[{ name: 'nav', label: 'Current NAV (₹)', type: 'number' }]} initial={{ nav: m?.nav?.nav }}
      onSubmit={async (v) => { await api.patch(`/investments/funds/${m.nav._id}`, { nav: v.nav, navDate: new Date() }); toast.success('NAV updated'); refresh(); }} />
    <FormModal open={!!m?.buy} onClose={() => setM(null)} title={`Buy / Sell · ${m?.buy?.name || ''}`} initial={{ type: 'BUY', date: isoDay(), nav: m?.buy?.nav }}
      fields={[{ name: 'type', label: 'Type', type: 'segment', options: ['BUY', 'SELL'] }, { name: 'amount', label: 'Amount (₹)', type: 'number' }, { name: 'nav', label: 'NAV (₹)', type: 'number' }, { name: 'date', label: 'Date', type: 'date', max: isoDay() },
        { name: 'account', label: 'Cash account (optional)', type: 'select', options: (accounts || []).map((a) => ({ value: a._id, label: a.name })) }]}
      footer={(v) => <Calc>Units = {v.amount && v.nav ? (v.amount / v.nav).toFixed(3) : '—'}</Calc>}
      onSubmit={async (v) => { await api.post(`/investments/funds/${m.buy._id}/transactions`, v); toast.success('Transaction recorded'); refresh(); }} />
  </>);
}

// ---------------- SIPs: fully automatic, monthly
function Sips() {
  const { data, loading } = useApi('/investments/sips');
  const { data: funds } = useApi('/investments/funds');
  const { data: accounts } = useApi('/accounts');
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); refresh(); } catch (e) { toast.error(e.response?.data?.error?.message || 'Action failed. Please try again.'); } };
  if (loading) return <Skeleton className="h-60" />;
  const active = data.filter((s) => s.status === 'ACTIVE');
  const monthly = active.reduce((s, x) => s + x.amount, 0);
  return (<>
    <Card className="flex flex-wrap items-center justify-between gap-4 !border-brand/25 bg-linear-to-r from-brand/10 to-transparent">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-soft"><Repeat size={20} /></span>
        <div><p className="font-semibold text-white">Automatic monthly SIPs</p><p className="max-w-xl text-sm text-slate-400">Each SIP runs by itself every month on its date, buys units at the fund's latest NAV and debits the chosen account. It is recorded as an investment, never an expense.</p></div></div>
      <div className="flex items-center gap-4"><div className="text-right"><p className="text-xs uppercase tracking-wider text-slate-400">Per month</p><p className="num text-xl font-semibold text-white">{money(monthly)}</p></div><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} />New SIP</button></div>
    </Card>
    {!data.length ? <Card><Empty title="No SIPs yet" hint={funds?.holdings?.length ? 'Create a SIP and it will run every month automatically.' : 'Add your mutual fund under the Mutual Funds tab first, then set up its SIP here.'} /></Card> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((s) => (
        <Card key={s._id}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold text-white">{s.fund?.name}</p><p className="text-xs text-slate-500">Debits {s.account?.name}</p></div>
            <Badge tone={s.status === 'ACTIVE' ? 'gain' : 'warn'}>{s.status === 'ACTIVE' ? 'Auto' : s.status}</Badge></div>
          <p className="num mt-3 text-2xl font-semibold text-white">{money(s.amount)}<span className="text-sm font-normal text-slate-500"> / month</span></p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock size={13} />{s.status === 'ACTIVE' ? `Next run ${dt(s.nextDate)}` : 'Not running'}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-ink-950/50 p-3 text-center">{[['Instalments', s.count], ['Invested', money(s.invested)], ['Units', s.units.toFixed(2)]].map(([k, v]) => <div key={k}><dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="num mt-0.5 text-xs font-medium text-white">{v}</dd></div>)}</dl>
          <div className="mt-4 flex gap-2">
            <button className="btn-ghost !min-h-[40px] flex-1" onClick={() => act(() => api.post(`/investments/sips/${s._id}/${s.status === 'ACTIVE' ? 'pause' : 'resume'}`), s.status === 'ACTIVE' ? 'SIP paused' : 'SIP resumed')}>{s.status === 'ACTIVE' ? <><Pause size={14} />Pause</> : <><Play size={14} />Resume</>}</button>
            <button title="Record an extra instalment now" aria-label="Record instalment now" className="btn-ghost !min-h-[40px] !px-3" onClick={() => act(() => api.post(`/investments/sips/${s._id}/execute`), 'Instalment recorded')}><Zap size={14} /></button>
            <button aria-label="Delete SIP" className="btn-danger !min-h-[40px] !px-3" onClick={() => confirm('Delete this SIP? Past instalments are kept.') && act(() => api.delete(`/investments/sips/${s._id}`), 'SIP deleted')}><Trash2 size={14} /></button></div>
        </Card>))}</div>}
    <FormModal open={open} onClose={() => setOpen(false)} title="New monthly SIP" initial={{ startDate: isoDay() }}
      fields={[{ name: 'fund', label: 'Mutual fund', type: 'select', placeholder: 'Choose a fund', options: (funds?.holdings || []).map((h) => ({ value: h.fund._id, label: h.fund.name })) }, { name: 'amount', label: 'Monthly amount (₹)', type: 'number' },
        { name: 'account', label: 'Debit account', type: 'select', options: (accounts || []).map((a) => ({ value: a._id, label: a.name })) }, { name: 'startDate', label: 'First instalment date', type: 'date' }, { name: 'endDate', label: 'End date (optional)', type: 'date', clearable: true }]}
      footer={() => <Calc>Runs on the same date every month. Needs the fund's NAV to be up to date.</Calc>}
      onSubmit={async (v) => { await api.post('/investments/sips', v); toast.success('SIP created'); refresh(); }} submitLabel="Create SIP" />
  </>);
}

// ---------------- Stocks (Indian ₹ / US $): shares + current price
function Stocks({ market }) {
  const US = market === 'US', cur = US ? 'USD' : 'INR', sym = US ? '$' : '₹';
  const { data, loading } = useApi('/investments/stocks', { market });
  const [m, setM] = useState(null);
  const toast = useToast();
  if (loading) return <Skeleton className="h-72" />;
  const s = data.summary;
  const cols = ['Symbol', 'Shares', 'Avg cost', 'Price', 'Value', 'P&L', ...(US ? ['Currency P&L (₹)'] : []), ''];
  return (<>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-400">{US ? `US portfolio in USD · ₹${data.usdInr}/USD` : 'Indian shares in ₹'}</p>
      <div className="flex gap-2"><button className="btn-ghost" onClick={() => setM('trade')}>Add trade</button><button className="btn-primary" onClick={() => setM('holding')}><Plus size={16} />Add current holding</button></div>
    </div>
    {!data.holdings.length ? <Card><Empty title={`No ${US ? 'US' : 'Indian'} stocks yet`} hint="Enter the shares you hold and the current price — we calculate the value." action={<button className="btn-primary" onClick={() => setM('holding')}>Add current holding</button>} /></Card> : (<>
      <Card><div className="grid grid-cols-2 gap-6 sm:grid-cols-5"><Stat label="Invested">{money(s.cost, cur)}</Stat><Stat label="Current value">{money(s.current, cur)}</Stat><Stat label="P&L"><PL v={s.pnl} p={s.pct} cur={cur} /></Stat><Stat label="Realized">{money(s.realized, cur)}</Stat>{US && <Stat label="≈ In INR">{money(s.currentInr)}</Stat>}</div></Card>
      <Card className="!p-0"><div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead className="border-b border-white/[0.07]"><tr>{cols.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody>{data.holdings.map((h) => (
          <tr key={h.ticker} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]">
            <td className="td font-semibold text-white">{h.ticker}</td><td className="td num">{h.shares}</td><td className="td num">{money(h.avgPrice, cur)}</td><td className="td num">{money(h.price, cur)}</td><td className="td num text-white">{money(h.current, cur)}</td>
            <td className="td"><PL v={h.stockPnl} p={h.pct} cur={cur} /></td>
            {US && <td className={cn('td num', h.currencyPnlInr >= 0 ? 'text-gain' : 'text-loss')}>{h.currencyPnlInr >= 0 ? '+' : '−'}{money(Math.abs(h.currencyPnlInr))}</td>}
            <td className="td"><div className="flex justify-end gap-1.5"><button className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={() => setM({ price: h })}><RefreshCw size={13} />Price</button><button aria-label="Edit holding" title="Edit" className="btn-ghost !min-h-[36px] !px-2.5" onClick={() => setM({ edit: h })}><Pencil size={13} /></button><button aria-label="Delete holding" title="Delete" className="btn-danger !min-h-[36px] !px-2.5" onClick={async () => { if (confirm(`Delete ${h.ticker} and all its entries?`)) { await api.delete('/investments/stocks/holding', { params: { market, ticker: h.ticker } }); toast.success('Holding deleted'); refresh(); } }}><Trash2 size={13} /></button></div></td></tr>))}</tbody></table></div></Card></>)}
    {data.transactions.length > 0 && (
      <Card><h3 className="mb-2 font-semibold text-white">Recent entries</h3>
        <ul className="divide-y divide-white/[0.06]">{data.transactions.slice(0, 8).map((t) => (
          <li key={t._id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div className="flex items-center gap-3"><Badge tone={t.type === 'BUY' ? 'gain' : t.type === 'SELL' ? 'loss' : 'brand'}>{t.type}</Badge><span className="font-medium text-white">{t.ticker}</span><span className="num text-slate-400">{t.shares} × {sym}{t.price}</span></div>
            <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{dt(t.date)}</span><button aria-label="Delete entry" className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-loss/10 hover:text-loss" onClick={async () => { if (confirm('Delete this entry?')) { await api.delete(`/investments/stocks/transactions/${t._id}`); toast.success('Entry deleted'); refresh(); } }}><Trash2 size={14} /></button></div></li>))}</ul></Card>)}

    <FormModal open={m === 'holding'} onClose={() => setM(null)} title={`Add current ${US ? 'US' : 'Indian'} holding`} initial={{}}
      fields={[{ name: 'ticker', label: 'Symbol', placeholder: US ? 'NVDA' : 'RELIANCE' }, { name: 'shares', label: 'Shares you hold', type: 'number' }, { name: 'price', label: `Current price (${sym})`, type: 'number' },
        { name: 'invested', label: `Total amount invested (${sym}, optional)`, type: 'number' }, ...(US ? [{ name: 'fxRate', label: 'USD/INR when you bought (optional)', type: 'number' }] : []), { name: 'date', label: 'Holding since (optional)', type: 'date', clearable: true, max: isoDay() }]}
      footer={(v) => { const val = (+v.shares || 0) * (+v.price || 0), inv = +v.invested || val; return <Calc>Current value = {money(val, cur)}{v.invested ? <> · P&L {val >= inv ? '+' : '−'}{money(Math.abs(val - inv), cur)}</> : <span className="text-slate-500"> · leave invested blank to start P&L at 0</span>}</Calc>; }}
      onSubmit={async (v) => { await api.post('/investments/stocks/holding', { ...v, market }); toast.success('Holding added'); refresh(); }} submitLabel="Add holding" />
    <FormModal open={m === 'trade'} onClose={() => setM(null)} title={`Add ${US ? 'US' : 'Indian'} stock trade`} initial={{ type: 'BUY', date: isoDay(), ...(US ? { fxRate: data.usdInr } : {}) }}
      fields={[{ name: 'ticker', label: 'Symbol' }, { name: 'type', label: 'Type', type: 'segment', options: ['BUY', 'SELL', 'DIVIDEND'] }, { name: 'shares', label: 'Shares', type: 'number' }, { name: 'price', label: `Price per share / dividend (${sym})`, type: 'number' },
        { name: 'fees', label: `Fees (${sym})`, type: 'number' }, { name: 'tax', label: `Taxes (${sym})`, type: 'number' }, ...(US ? [{ name: 'fxRate', label: 'USD/INR on trade date', type: 'number' }] : []), { name: 'date', label: 'Date', type: 'date', max: isoDay() }]}
      onSubmit={async (v) => { await api.post('/investments/stocks/transactions', { ...v, market }); toast.success('Trade recorded'); refresh(); }} />
    <FormModal open={!!m?.edit} onClose={() => setM(null)} title={`Edit · ${m?.edit?.ticker || ''}`} submitLabel="Save changes"
      initial={m?.edit ? { ticker: m.edit.ticker, shares: m.edit.shares, price: m.edit.price, invested: m.edit.cost, ...(US ? { fxRate: m.edit.avgFx } : {}) } : {}}
      fields={[{ name: 'ticker', label: 'Symbol' }, { name: 'shares', label: 'Shares you hold', type: 'number' }, { name: 'price', label: `Current price (${sym})`, type: 'number' }, { name: 'invested', label: `Total amount invested (${sym})`, type: 'number' }, ...(US ? [{ name: 'fxRate', label: 'USD/INR when you bought', type: 'number' }] : [])]}
      footer={(v) => { const val = (+v.shares || 0) * (+v.price || 0), inv = +v.invested || 0; return <Calc>Current value = {money(val, cur)} · P&L {val >= inv ? '+' : '−'}{money(Math.abs(val - inv), cur)}</Calc>; }}
      onSubmit={async (v) => { const { ticker, ...rest } = v; await api.patch('/investments/stocks/holding', { ...rest, market, ticker: m.edit.ticker, newTicker: ticker }); toast.success('Holding updated'); refresh(); }} />
    <FormModal open={!!m?.price} onClose={() => setM(null)} title={`Current price · ${m?.price?.ticker || ''}`} initial={{ price: m?.price?.price }} fields={[{ name: 'price', label: `Price (${sym})`, type: 'number' }]}
      onSubmit={async (v) => { await api.put('/investments/stocks/prices', { ticker: m.price.ticker, price: v.price, market }); toast.success('Price updated'); refresh(); }} />
  </>);
}
