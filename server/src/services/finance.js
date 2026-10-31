import { Account, Transaction, Fund, MfTxn, StockTxn, StockPrice, User, Recurring, Budget, Goal } from '../models/index.js';
import mongoose from 'mongoose';
import { n, r2, xirr, savingsRate, pctChange, position, calculateUnits, goalStats } from '../utils/engine.js';
import { balancesAt, split, stockBook } from '../utils/ledger.js';

export { balancesAt };

export async function loadAll(userId) {
  const [accs, txns] = await Promise.all([
    Account.find({ user: userId, deletedAt: null }).lean(),
    Transaction.find({ user: userId, deletedAt: null }).lean(),
  ]);
  return { accs, txns };
}

export async function portfolio(userId) {
  const [user, funds, mf, stx, prices] = await Promise.all([
    User.findById(userId).lean(),
    Fund.find({ user: userId }).lean(),
    MfTxn.find({ user: userId }).lean(),
    StockTxn.find({ user: userId }).lean(),
    StockPrice.find({ user: userId }).lean(),
  ]);
  const rate = user?.usdInr || 90;
  const now = new Date();
  const flowOf = (t) => ({ date: new Date(t.date), amount: t.type === 'BUY' ? -(n(t.amount) + n(t.fees)) : t.type === 'ADJUSTMENT' ? -n(t.amount) : n(t.amount) });

  const mfHoldings = funds.map((f) => {
    const tx = mf.filter((t) => String(t.fund) === String(f._id));
    const p = position(tx);
    const nav = n(f.nav);
    const current = r2(p.units * nav);
    const flows = tx.filter((t) => t.type !== 'DIVIDEND').map(flowOf);
    if (p.units > 0) flows.push({ date: now, amount: current });
    const unrealized = r2(current - p.cost);
    return { fund: f, ...p, nav, current, unrealized, pct: p.cost ? r2((unrealized / p.cost) * 100) : 0, xirr: xirr(flows) };
  });
  const mfInvested = r2(mfHoldings.reduce((s, h) => s + h.cost, 0));
  const mfCurrent = r2(mfHoldings.reduce((s, h) => s + h.current, 0));
  const allFlows = mf.filter((t) => t.type !== 'DIVIDEND').map(flowOf);
  if (mfCurrent > 0) allFlows.push({ date: now, amount: mfCurrent });

  const isIN = (x) => x.market === 'IN';
  const us = stockBook(stx.filter((t) => !isIN(t)), prices.filter((p) => !isIN(p)), rate);
  const inn = stockBook(stx.filter(isIN), prices.filter(isIN), 1);

  const invested = r2(mfInvested + us.cost * rate + inn.cost);
  const current = r2(mfCurrent + us.currentInr + inn.current);
  return {
    usdInr: rate,
    mf: { invested: mfInvested, current: mfCurrent, pnl: r2(mfCurrent - mfInvested), pct: mfInvested ? r2(((mfCurrent - mfInvested) / mfInvested) * 100) : 0, xirr: xirr(allFlows), realized: r2(mfHoldings.reduce((s, h) => s + h.realized, 0)), holdings: mfHoldings },
    us, in: inn,
    total: { invested, current, pnl: r2(current - invested), pct: invested ? r2(((current - invested) / invested) * 100) : 0 },
  };
}

const mkey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export async function dashboard(userId, month) {
  const now = new Date();
  const [y, m] = (month || mkey(now)).split('-').map(Number);
  const key = mkey(new Date(Date.UTC(y, m - 1, 1)));
  const prevKey = mkey(new Date(Date.UTC(y, m - 2, 1)));
  const { accs, txns } = await loadAll(userId);
  const pf = await portfolio(userId);
  const accounts = balancesAt(accs, txns);
  const { cash, liabilities } = split(accounts);

  const byMonth = {};
  const exp = {};
  for (const t of txns) {
    const k = mkey(new Date(t.date));
    const b = (byMonth[k] ||= { income: 0, expense: 0, invest: 0 });
    const a = n(t.amount);
    if (t.type === 'INCOME') b.income += a;
    else if (t.type === 'EXPENSE') b.expense += a;
    else if (t.type === 'REFUND') b.expense -= a;
    else if (t.type === 'INVESTMENT') b.invest += t.flow === 'in' ? -a : a;
    if (k === key && t.type === 'EXPENSE') exp[t.category || 'Uncategorised'] = (exp[t.category || 'Uncategorised'] || 0) + a;
  }
  const cur = byMonth[key] || { income: 0, expense: 0, invest: 0 };
  const prev = byMonth[prevKey] || { income: 0, expense: 0, invest: 0 };

  const cashFlow = [], netWorthTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const k = mkey(d), b = byMonth[k] || { income: 0, expense: 0, invest: 0 };
    const label = d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
    cashFlow.push({ month: label, income: r2(b.income), expense: r2(b.expense), savings: r2(b.income - b.expense) });
    const end = new Date(Date.UTC(y, m - 1 - i + 1, 0, 23, 59, 59));
    const c = split(balancesAt(accs, txns, end));
    const investedCost = txns.filter((t) => t.type === 'INVESTMENT' && new Date(t.date) <= end).reduce((s, t) => s + (t.flow === 'in' ? -n(t.amount) : n(t.amount)), 0);
    netWorthTrend.push({ month: label, value: r2(c.cash + Math.max(0, investedCost) - c.liabilities) });
  }
  const investmentsNow = pf.total.current;
  if (netWorthTrend.length) netWorthTrend[netWorthTrend.length - 1].value = r2(cash + investmentsNow - liabilities);

  const [recurring, budgets, goals] = await Promise.all([
    Recurring.find({ user: userId, status: 'ACTIVE', nextOccurrence: { $lte: new Date(+now + 35 * 864e5) } }).sort({ nextOccurrence: 1 }).limit(6).lean(),
    Budget.find({ user: userId, month: key }).lean(),
    Goal.find({ user: userId }).lean(),
  ]);
  const accName = Object.fromEntries(accounts.map((a) => [String(a._id), a.name]));
  const recent = txns.filter((t) => t.type !== 'TRANSFER' || true).sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8).map((t) => ({ ...t, accountName: accName[String(t.account)] }));
  const total = Object.values(exp).reduce((s, v) => s + v, 0);

  return {
    month: key,
    netWorth: { value: r2(cash + investmentsNow - liabilities), cash, investments: investmentsNow, liabilities, trend: netWorthTrend },
    cash: { value: cash, accounts: accounts.length },
    income: { value: r2(cur.income), prev: r2(prev.income), change: pctChange(cur.income, prev.income) },
    expenses: { value: r2(cur.expense), prev: r2(prev.expense), change: pctChange(cur.expense, prev.expense) },
    savings: { value: r2(cur.income - cur.expense), rate: savingsRate(cur.income, cur.expense), prevRate: savingsRate(prev.income, prev.expense), invested: r2(cur.invest), unallocated: r2(cur.income - cur.expense - cur.invest) },
    cashFlow,
    breakdown: Object.entries(exp).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: r2(value), pct: total ? r2((value / total) * 100) : 0 })),
    investments: { ...pf.total, mf: pf.mf.current, us: pf.us.currentInr, inStocks: pf.in.current, xirr: pf.mf.xirr },
    upcoming: recurring.map((r) => ({ _id: r._id, description: r.description, amount: r.amount, type: r.type, date: r.nextOccurrence })),
    budgets: budgets.map((b) => ({ category: b.category, budget: n(b.amount), spent: r2(exp[b.category] || 0), pct: n(b.amount) ? r2(((exp[b.category] || 0) / n(b.amount)) * 100) : 0 })),
    goals: goals.map((g) => ({ _id: g._id, name: g.name, targetDate: g.targetDate, ...goalStats(g, g.contributions) })).slice(0, 4),
    recent,
  };
}

// Executes a SIP instalment at the fund's current NAV; creates MF txn + linked cash outflow.
export async function executeSip(sip, date = new Date()) {
  const fund = await Fund.findById(sip.fund).lean();
  const nav = n(fund?.nav);
  if (!nav) throw Object.assign(new Error('Set a NAV for this fund first'), { status: 422, code: 'NAV_REQUIRED' });
  const amount = n(sip.amount);
  const cashId = new mongoose.Types.ObjectId();
  // Fund entry first: the unique (sip, date) index rejects a duplicate instalment before any cash moves.
  const tx = await MfTxn.create({ user: sip.user, fund: sip.fund, type: 'BUY', date, amount, nav, units: calculateUnits(amount, nav), cashTxn: cashId, sip: sip._id });
  try {
    await Transaction.create({ _id: cashId, user: sip.user, account: sip.account, type: 'INVESTMENT', flow: 'out', amount, category: 'SIP', description: `SIP - ${fund.name}`, date });
  } catch (e) {
    await MfTxn.deleteOne({ _id: tx._id }); // compensate so we never keep half an instalment
    throw e;
  }
  return tx;
}
