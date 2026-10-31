import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnits, calculatePnL, savingsRate, pctChange, xirr, nextDate, goalStats, position, r2 } from '../src/utils/engine.js';
import { balancesAt, split, stockBook } from '../src/utils/ledger.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);
const iso = (d) => d.toISOString().slice(0, 10);

test('units = amount / NAV (and 0 when NAV is 0)', () => {
  assert.equal(calculateUnits(10000, 50), 200);
  assert.equal(calculateUnits(5000, 0), 0);
});

test('P&L and percentage', () => {
  assert.deepEqual(calculatePnL(10000, 12000), { pnl: 2000, pct: 20 });
  assert.deepEqual(calculatePnL(0, 500), { pnl: 500, pct: 0 });
});

test('savings rate and percentage change guards', () => {
  assert.equal(savingsRate(35000, 20000), 42.86);
  assert.equal(savingsRate(0, 500), 0);
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(50, 0), null);
});

test('xirr: 1000 -> 1100 after one year is 10 percent', () => {
  near(xirr([{ date: new Date('2025-01-01'), amount: -1000 }, { date: new Date('2026-01-01'), amount: 1100 }]), 10, 0.05);
});
test('xirr: no valid answer returns null', () => {
  assert.equal(xirr([{ date: new Date('2025-01-01'), amount: -1000 }]), null);
  assert.equal(xirr([{ date: new Date('2025-01-01'), amount: 1000 }, { date: new Date('2026-01-01'), amount: 500 }]), null);
});
test('xirr: flows given out of order give the same answer', () => {
  const a = [{ date: new Date('2025-01-01'), amount: -1000 }, { date: new Date('2025-07-01'), amount: -1000 }, { date: new Date('2026-01-01'), amount: 2300 }];
  assert.equal(xirr(a), xirr([...a].reverse()));
});

test('nextDate: month end clamping and year rollover', () => {
  assert.equal(iso(nextDate(new Date('2026-01-31T00:00:00Z'), 'MONTHLY')), '2026-02-28');
  assert.equal(iso(nextDate(new Date('2028-01-31T00:00:00Z'), 'MONTHLY')), '2028-02-29'); // leap year
  assert.equal(iso(nextDate(new Date('2026-12-15T00:00:00Z'), 'MONTHLY')), '2027-01-15');
  assert.equal(iso(nextDate(new Date('2026-01-01T00:00:00Z'), 'WEEKLY')), '2026-01-08');
  assert.equal(iso(nextDate(new Date('2026-03-10T00:00:00Z'), 'YEARLY')), '2027-03-10');
});

test('goalStats: required monthly saving and statuses', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const goal = { targetAmount: 100000, targetDate: new Date(+now + 5 * 30.4375 * 864e5) };
  const at = (amount) => [{ amount, date: new Date(+now - 10 * 864e5) }];

  const none = goalStats(goal, [], now);
  assert.equal(none.required, 20000);   // 100000 over 5 months
  assert.equal(none.status, 'BEHIND');
  assert.equal(goalStats(goal, at(30000), now).status, 'AT_RISK');
  assert.equal(goalStats(goal, at(40000), now).status, 'ON_TRACK');
  assert.equal(goalStats(goal, at(100000), now).status, 'COMPLETED');
  assert.equal(goalStats({ ...goal, paused: true }, [], now).status, 'PAUSED');
  assert.equal(goalStats(goal, at(30000), now).progress, 30);
});

test('position: average cost, realised profit, adjustment', () => {
  const tx = [
    { type: 'BUY', date: '2026-01-05', units: 100, amount: 5000 },
    { type: 'BUY', date: '2026-02-05', units: 90.909, amount: 5000 },
    { type: 'SELL', date: '2026-03-01', units: 40, amount: 2400 },
  ];
  const p = position(tx);
  near(p.units, 150.909, 0.001);
  near(p.cost, 7904.76);
  near(p.realized, 304.76);
  // entries supplied out of order give the same result
  assert.deepEqual(position([...tx].reverse()), p);
  // adjustment adds signed units and cost without touching realised profit
  const adj = position([...tx, { type: 'ADJUSTMENT', date: '2026-04-01', units: 20, amount: 1200 }]);
  near(adj.units, 170.909, 0.001);
  near(adj.cost, 9104.76);
  assert.equal(adj.realized, p.realized);
});

test('balancesAt: income, expense, transfer, investment, refund', () => {
  const accs = [{ _id: 'a', openingBalance: 1000 }, { _id: 'b', openingBalance: 500 }];
  const d = (m) => new Date(`2026-${m}-10`);
  const txns = [
    { type: 'INCOME', account: 'a', amount: 200, date: d('01') },
    { type: 'EXPENSE', account: 'a', amount: 50, date: d('01') },
    { type: 'TRANSFER', account: 'a', toAccount: 'b', amount: 300, date: d('02') },
    { type: 'INVESTMENT', flow: 'out', account: 'a', amount: 100, date: d('02') },
    { type: 'INVESTMENT', flow: 'in', account: 'a', amount: 30, date: d('03') },
    { type: 'REFUND', account: 'b', amount: 20, date: d('03') },
  ];
  const bal = Object.fromEntries(balancesAt(accs, txns).map((x) => [x._id, x.balance]));
  assert.deepEqual(bal, { a: 780, b: 820 });
  assert.equal(bal.a + bal.b, 1000 + 500 + 200 - 50 - 100 + 30 + 20);   // transfer moves money, never creates it
  const feb = Object.fromEntries(balancesAt(accs, txns, new Date('2026-02-28')).map((x) => [x._id, x.balance]));
  assert.deepEqual(feb, { a: 750, b: 800 });   // history can be rebuilt for any date
});

test('split: credit card balances become liabilities', () => {
  const r = split([{ type: 'Savings Account', balance: 1000 }, { type: 'Cash', balance: 200 }, { type: 'Credit Card', balance: -300 }]);
  assert.deepEqual(r, { cash: 1200, liabilities: 300 });
});

test('stockBook: USD stock P&L + currency P&L add up to the INR gain', () => {
  const tx = [{ ticker: 'NVDA', type: 'BUY', shares: 10, price: 100, fees: 0, tax: 0, fxRate: 85, date: '2026-01-02' }];
  const book = stockBook(tx, [{ ticker: 'NVDA', price: 120 }], 90);
  const h = book.holdings[0];
  assert.equal(h.cost, 1000);
  assert.equal(h.current, 1200);
  assert.equal(h.stockPnlInr, 18000);
  assert.equal(h.currencyPnlInr, 5000);
  assert.equal(h.currentInr, 108000);
  assert.equal(h.stockPnlInr + h.currencyPnlInr, r2(h.currentInr - h.cost * 85));
});

test('stockBook: Indian stocks have no currency effect; adjustment and fallback price work', () => {
  const tx = [
    { ticker: 'RELIANCE', type: 'BUY', shares: 10, price: 2500, fees: 0, tax: 0, fxRate: 1, date: '2026-01-02' },
    { ticker: 'RELIANCE', type: 'ADJUSTMENT', shares: 5, amount: 13000, price: 0, fxRate: 1, date: '2026-02-01' },
  ];
  const h = stockBook(tx, [], 1).holdings[0];     // no stored price: falls back to the last BUY price
  assert.equal(h.shares, 15);
  assert.equal(h.cost, 38000);
  assert.equal(h.price, 2500);
  assert.equal(h.currencyPnlInr, 0);
});
