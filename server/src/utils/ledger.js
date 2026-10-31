// Pure ledger maths: balances, cash/liability split, stock books. No database, no HTTP - fully unit-testable.
import { n, r2, position } from './engine.js';

export const delta = (t) => {
  const a = n(t.amount);
  if (t.type === 'INCOME' || t.type === 'REFUND' || t.type === 'ADJUSTMENT') return a;
  if (t.type === 'EXPENSE') return -a;
  if (t.type === 'INVESTMENT') return t.flow === 'in' ? a : -a;
  return 0;
};

// Opening balance + income + transfers in - expenses - transfers out (as of `upTo`)
export function balancesAt(accs, txns, upTo) {
  const map = new Map(accs.map((a) => [String(a._id), n(a.openingBalance)]));
  for (const t of txns) {
    if (upTo && new Date(t.date) > upTo) continue;
    const a = n(t.amount), id = String(t.account);
    if (t.type === 'TRANSFER') {
      if (map.has(id)) map.set(id, map.get(id) - a);
      const to = String(t.toAccount);
      if (map.has(to)) map.set(to, map.get(to) + a);
    } else if (map.has(id)) map.set(id, map.get(id) + delta(t));
  }
  return accs.map((a) => ({ ...a, balance: r2(map.get(String(a._id))) }));
}

export const split = (list) => {
  const cash = list.filter((a) => a.type !== 'Credit Card').reduce((s, a) => s + a.balance, 0);
  const liabilities = list.filter((a) => a.type === 'Credit Card').reduce((s, a) => s - Math.min(0, a.balance), 0);
  return { cash: r2(cash), liabilities: r2(liabilities) };
};

// Stock book for one market. rate = 1 for INR stocks, USD/INR for US stocks.
export const stockBook = (txns, prices, rate) => {
  const holdings = [...new Set(txns.map((t) => t.ticker))].map((tk) => {
    const tx = txns.filter((t) => t.ticker === tk).map((t) => ({ ...t, units: t.shares, amount: t.type === 'ADJUSTMENT' ? n(t.amount) : n(t.price) * (t.type === 'DIVIDEND' && !t.shares ? 1 : t.shares) }));
    const p = position(tx, (t) => n(t.price) * t.shares + n(t.fees) + n(t.tax));
    const lastPrice = n([...tx].filter((t) => t.type === 'BUY' || t.type === 'SELL').sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]?.price);
    const price = n(prices.find((x) => x.ticker === tk)?.price) || lastPrice;
    const current = r2(p.units * price);
    const costOfTxn = (t) => (t.type === 'ADJUSTMENT' ? n(t.amount) : n(t.price) * t.shares + n(t.fees) + n(t.tax));
    const buys = tx.filter((t) => t.type === 'BUY' || (t.type === 'ADJUSTMENT' && n(t.amount) > 0));
    const buyCost = buys.reduce((s, t) => s + costOfTxn(t), 0);
    const avgFx = buyCost ? buys.reduce((s, t) => s + costOfTxn(t) * t.fxRate, 0) / buyCost : rate;
    const pnl = r2(current - p.cost);
    return {
      ticker: tk, shares: p.units, avgPrice: p.units ? r2(p.cost / p.units) : 0, price, cost: p.cost, current,
      stockPnl: pnl, pct: p.cost ? r2((pnl / p.cost) * 100) : 0, realized: p.realized, dividends: p.dividends,
      avgFx: r2(avgFx), stockPnlInr: r2(pnl * rate), currencyPnlInr: r2(p.cost * (rate - avgFx)), currentInr: r2(current * rate),
    };
  });
  const sum = (k) => r2(holdings.reduce((s, h) => s + h[k], 0));
  const cost = sum('cost'), current = sum('current');
  return { cost, current, pnl: r2(current - cost), pct: cost ? r2(((current - cost) / cost) * 100) : 0, currentInr: r2(current * rate), realized: sum('realized'), dividends: sum('dividends'), holdings };
};
