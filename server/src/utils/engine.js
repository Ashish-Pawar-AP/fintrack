// Financial engine: pure functions, no DB, no HTTP. Money math is rounded to 2dp.
export const n = (v) => (v == null ? 0 : typeof v === 'number' ? v : parseFloat(v.toString()));
export const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
export const r3 = (x) => Math.round((x + Number.EPSILON) * 1000) / 1000;
export const r4 = (x) => Math.round((x + Number.EPSILON) * 10000) / 10000;

export const calculateUnits = (amount, nav) => (nav > 0 ? r3(amount / nav) : 0);
export const calculateCurrentValue = (units, nav) => r2(units * nav);
export const calculatePnL = (invested, current) => ({
  pnl: r2(current - invested),
  pct: invested ? r2(((current - invested) / invested) * 100) : 0,
});
export const savingsRate = (income, expense) => (income > 0 ? r2(((income - expense) / income) * 100) : 0);
export const pctChange = (cur, prev) => (prev ? r2(((cur - prev) / Math.abs(prev)) * 100) : null);

export function xirr(flows) {
  const f = flows.filter((x) => x.amount !== 0).sort((a, b) => +a.date - +b.date);
  if (f.length < 2 || !f.some((x) => x.amount < 0) || !f.some((x) => x.amount > 0)) return null;
  const t0 = +f[0].date;
  const yrs = (d) => (+d - t0) / (365 * 864e5);
  const npv = (r) => f.reduce((s, x) => s + x.amount / Math.pow(1 + r, yrs(x.date)), 0);
  let lo = -0.99, hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return r2(((lo + hi) / 2) * 100);
}

export function nextDate(d, freq, interval = 1) {
  const x = new Date(d);
  const day = x.getUTCDate();
  if (freq === 'WEEKLY') x.setUTCDate(day + 7 * interval);
  else if (freq === 'YEARLY') x.setUTCFullYear(x.getUTCFullYear() + interval);
  else {
    x.setUTCDate(1);
    x.setUTCMonth(x.getUTCMonth() + interval);
    const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
    x.setUTCDate(Math.min(day, last));
  }
  return x;
}

export function goalStats(g, contribs, now = new Date()) {
  const current = r2(contribs.reduce((s, c) => s + n(c.amount), 0));
  const target = n(g.targetAmount);
  const remaining = Math.max(0, r2(target - current));
  const progress = target ? r2(Math.min(100, (current / target) * 100)) : 0;
  let monthsLeft = null, required = null;
  if (g.targetDate) {
    monthsLeft = Math.max(0, (new Date(g.targetDate) - now) / (30.4375 * 864e5));
    required = remaining === 0 ? 0 : r2(remaining / Math.max(monthsLeft, 1));
  }
  const since = new Date(+now - 90 * 864e5);
  const monthly = r2(contribs.filter((c) => new Date(c.date) >= since).reduce((s, c) => s + n(c.amount), 0) / 3);
  let status = 'ON_TRACK';
  if (g.paused) status = 'PAUSED';
  else if (remaining === 0) status = 'COMPLETED';
  else if (required != null) {
    if (monthsLeft <= 0) status = 'BEHIND';
    else if (monthly >= required * 0.95) status = 'ON_TRACK';
    else if (monthly >= required * 0.6) status = 'AT_RISK';
    else status = 'BEHIND';
  }
  return {
    current, target, remaining, progress, status, monthly, required,
    monthsLeft: monthsLeft == null ? null : Math.round(monthsLeft * 10) / 10,
    shortfall: required != null ? Math.max(0, r2(required - monthly)) : null,
  };
}

// Average-cost position builder for MF/stock transactions.
export function position(txns, costOf = (t) => n(t.amount) + n(t.fees)) {
  let units = 0, cost = 0, realized = 0, dividends = 0;
  for (const t of [...txns].sort((a, b) => +new Date(a.date) - +new Date(b.date))) {
    if (t.type === 'BUY') { units += t.units; cost += costOf(t); }
    else if (t.type === 'SELL' && units > 0) {
      const q = Math.min(t.units, units), avg = cost / units;
      realized += n(t.amount) - n(t.fees) - avg * q;
      cost -= avg * q; units -= q;
    } else if (t.type === 'ADJUSTMENT') { units += t.units; cost += n(t.amount); // manual edit: signed units & cost
    } else if (t.type === 'DIVIDEND') dividends += n(t.amount);
    else if (t.type === 'BONUS' || t.type === 'SPLIT') units += t.units;
  }
  return { units: r4(units), cost: r2(cost), realized: r2(realized), dividends: r2(dividends) };
}
