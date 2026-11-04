import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Landmark, PiggyBank, Gauge, Calendar } from 'lucide-react';
import { useApi } from '../lib/api';
import { MonthPicker } from '../components/pickers';
import { useAuth } from '../context/AuthContext';
import { money, compact, dShort, monthKey, pct } from '../lib/format';
import { Page, Card, CountUp, Delta, Empty, PageSkeleton, Progress, Ring, Badge, cn } from '../components/ui';

const COLORS = ['#3B82F6', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#22D3EE', '#94A3B8'];
const Tip = ({ active, payload, label }) => active && payload?.length ? (
  <div className="rounded-xl border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
    <p className="mb-1 font-medium text-white">{label}</p>
    {payload.map((p) => <p key={p.name} className="num" style={{ color: p.color || p.fill }}>{p.name}: {money(p.value)}</p>)}
  </div>) : null;

function Kpi({ icon: I, label, value, tone = 'brand', children, format }) {
  const t = { brand: 'text-brand-soft bg-brand/10', gain: 'text-gain bg-gain/10', warn: 'text-warn bg-warn/10', loss: 'text-loss bg-loss/10' }[tone];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span><span className={cn('grid h-8 w-8 place-items-center rounded-lg', t)}><I size={16} /></span></div>
      <p className="num text-2xl font-semibold text-white xl:text-[1.65rem]"><CountUp value={value} format={format || ((v) => money(Math.round(v)))} /></p>
      <div className="min-h-[18px]">{children}</div>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(monthKey());
  const { data: d, loading } = useApi('/dashboard', { month });
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const empty = d && d.netWorth.cash === 0 && d.cash.accounts === 0;

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white sm:text-3xl">{hi}, <span className="grad-text">{user.name}</span></h1>
          <p className="mt-1 text-sm text-slate-400">Your money at a glance for {new Date(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}: net worth, cash flow, spending, goals and investments.</p></div>
        <MonthPicker value={month} max={monthKey()} onChange={setMonth} className="w-52" />
      </div>

      {loading && <PageSkeleton />}
      {empty && <Card><Empty title="Your financial dashboard is waiting for data" hint="Add your first account to get started." action={<Link to="/accounts" className="btn-primary">Add account</Link>} /></Card>}
      {d && !empty && (<>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Landmark} label="Net worth" value={d.netWorth.value}><span className="text-xs text-slate-500">Cash + investments{d.netWorth.liabilities ? ' − liabilities' : ''}</span></Kpi>
          <Kpi icon={Wallet} label="Cash" value={d.cash.value} tone="gain"><span className="text-xs text-slate-500">{d.cash.accounts} accounts</span></Kpi>
          <Kpi icon={TrendingUp} label="Investments" value={d.investments.current} tone="brand"><span className={cn('text-xs font-medium', d.investments.pnl >= 0 ? 'text-gain' : 'text-loss')}>{d.investments.pnl >= 0 ? '▲ +' : '▼ '}{money(d.investments.pnl)} P&L</span></Kpi>
          <Kpi icon={ArrowUpRight} label="Income" value={d.income.value} tone="gain"><Delta value={d.income.change} /></Kpi>
          <Kpi icon={ArrowDownRight} label="Expenses" value={d.expenses.value} tone="loss"><Delta value={d.expenses.change} invert /></Kpi>
          <Kpi icon={Gauge} label="Savings rate" value={d.savings.rate} tone="warn" format={(v) => `${v.toFixed(1)}%`}><span className="text-xs text-slate-500">Invested {compact(d.savings.invested)} separately</span></Kpi>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">Net worth trend</h3><Badge tone="brand">6 months</Badge></div>
            <div className="h-64"><ResponsiveContainer>
              <AreaChart data={d.netWorth.trend} margin={{ left: -10, right: 8, top: 8 }}>
                <defs><linearGradient id="nw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.45} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => compact(v)} />
                <Tooltip content={<Tip />} />
                <Area name="Net worth" type="monotone" dataKey="value" stroke="#60A5FA" strokeWidth={2.5} fill="url(#nw)" animationDuration={1400} />
              </AreaChart></ResponsiveContainer></div>
          </Card>
          <Card>
            <h3 className="mb-1 font-semibold text-white">Expense breakdown</h3>
            {d.breakdown.length === 0 ? <Empty title="No expenses yet" hint="Add an expense to see where money goes." /> : (<>
              <div className="h-44"><ResponsiveContainer><PieChart>
                <Pie data={d.breakdown.slice(0, 7)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none" animationDuration={1200}>{d.breakdown.slice(0, 7).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                <Tooltip content={<Tip />} /></PieChart></ResponsiveContainer></div>
              <ul className="space-y-1.5">{d.breakdown.slice(0, 5).map((b, i) => (
                <li key={b.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-300"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{b.name}</span><span className="num text-slate-400">{b.pct}% · {compact(b.value)}</span></li>))}</ul></>)}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <h3 className="mb-3 font-semibold text-white">Income vs expense</h3>
            <div className="h-60"><ResponsiveContainer><BarChart data={d.cashFlow} margin={{ left: -10, right: 8 }} barGap={4}>
              <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => compact(v)} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Bar name="Income" dataKey="income" fill="#34D399" radius={[6, 6, 0, 0]} animationDuration={1200} />
              <Bar name="Expense" dataKey="expense" fill="#F87171" radius={[6, 6, 0, 0]} animationDuration={1400} />
              <Bar name="Savings" dataKey="savings" fill="#60A5FA" radius={[6, 6, 0, 0]} animationDuration={1600} />
            </BarChart></ResponsiveContainer></div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-gain" />Income</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-loss" />Expense</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-soft" />Savings</span></div>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">Upcoming</h3><Calendar size={16} className="text-slate-500" /></div>
            {d.upcoming.length === 0 ? <Empty title="Nothing due" hint="Recurring bills show up here." /> : (
              <ul className="divide-y divide-white/[0.06]">{d.upcoming.map((u) => (
                <li key={u._id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium text-white">{u.description}</p><p className="text-xs text-slate-500">{dShort(u.date)}</p></div><span className={cn('num text-sm font-medium', u.type === 'INCOME' ? 'text-gain' : 'text-slate-200')}>{u.type === 'INCOME' ? '+' : '−'}{money(u.amount)}</span></li>))}</ul>)}
            <p className="mt-2 text-[11px] text-slate-500">Projected, not actual.</p>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-white">Goals</h3><Link to="/goals" className="text-xs text-brand-soft hover:underline">View all</Link></div>
            {d.goals.length === 0 ? <Empty title="No goals yet" hint="Create one to track progress." /> : (
              <div className="space-y-4">{d.goals.map((g) => (
                <div key={g._id} className="flex items-center gap-4"><Ring value={g.progress} size={56} stroke={6} tone={g.status === 'BEHIND' ? '#F87171' : g.status === 'AT_RISK' ? '#FBBF24' : '#34D399'}>{Math.round(g.progress)}%</Ring>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{g.name}</p><p className="num text-xs text-slate-400">{compact(g.current)} / {compact(g.target)}</p></div></div>))}</div>)}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-white">Budgets</h3><Link to="/budgets" className="text-xs text-brand-soft hover:underline">Manage</Link></div>
            {d.budgets.length === 0 ? <Empty title="No budgets set" hint="Set a monthly limit per category." /> : (
              <div className="space-y-4">{d.budgets.map((b) => (
                <div key={b.category}><div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-300">{b.category}</span><span className={cn('num', b.pct > 100 ? 'text-loss' : b.pct > 80 ? 'text-warn' : 'text-slate-400')}>{Math.round(b.pct)}%{b.pct > 100 ? ' · over' : ''}</span></div>
                  <Progress value={b.pct} tone={b.pct > 100 ? 'loss' : b.pct > 80 ? 'warn' : 'gain'} /></div>))}</div>)}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-white">Investments</h3><Link to="/investments" className="text-xs text-brand-soft hover:underline">Details</Link></div>
            <dl className="space-y-3 text-sm">
              {[['Invested', money(d.investments.invested)], ['Current value', money(d.investments.current)], ['Mutual funds', money(d.investments.mf)], ['Indian stocks', money(d.investments.inStocks)], ['US stocks (INR)', money(d.investments.us)]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-slate-400">{k}</dt><dd className="num text-white">{v}</dd></div>)}
              <div className="flex justify-between border-t border-white/[0.06] pt-3"><dt className="text-slate-400">P&L</dt><dd className={cn('num font-semibold', d.investments.pnl >= 0 ? 'text-gain' : 'text-loss')}>{d.investments.pnl >= 0 ? '▲ +' : '▼ '}{money(d.investments.pnl)} ({pct(d.investments.pct)})</dd></div>
              {d.investments.xirr != null && <div className="flex justify-between"><dt className="text-slate-400">MF XIRR</dt><dd className="num text-white">{d.investments.xirr}%</dd></div>}
            </dl>
          </Card>
        </div>

        <Card>
          <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-white">Recent transactions</h3><Link to="/transactions" className="text-xs text-brand-soft hover:underline">See all</Link></div>
          {d.recent.length === 0 ? <Empty title="No transactions yet" hint="Start tracking your first income or expense." /> : (
            <ul className="divide-y divide-white/[0.06]">{d.recent.map((t) => { const inc = t.type === 'INCOME' || t.type === 'REFUND' || (t.type === 'INVESTMENT' && t.flow === 'in'); const tr = t.type === 'TRANSFER'; return (
              <li key={t._id} className="flex items-center justify-between py-3"><div className="flex items-center gap-3"><span className={cn('grid h-9 w-9 place-items-center rounded-full text-sm', tr ? 'bg-brand/10 text-brand-soft' : inc ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss')}>{tr ? '⇄' : inc ? '↑' : '↓'}</span>
                <div><p className="text-sm font-medium text-white">{t.description || t.category || t.type}</p><p className="text-xs text-slate-500">{t.category || t.type} · {t.accountName} · {dShort(t.date)}</p></div></div>
                <span className={cn('num text-sm font-medium', tr ? 'text-slate-300' : inc ? 'text-gain' : 'text-loss')}>{tr ? '' : inc ? '+' : '−'}{money(t.amount)}</span></li>); })}</ul>)}
        </Card>
      </>)}
    </Page>
  );
}
