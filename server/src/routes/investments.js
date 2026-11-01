import { Router } from 'express';
import { z } from 'zod';
import { Fund, MfTxn, Sip, StockTxn, StockPrice, Transaction, Account, User } from '../models/index.js';
import { wrap, ok, parse, AppError } from '../utils/http.js';
import { crud } from '../utils/crud.js';
import { r2, n, calculateUnits, nextDate, position } from '../utils/engine.js';
import { portfolio, executeSip } from '../services/finance.js';

const r = Router();
const money = z.coerce.number().positive().transform(r2);
const optMoney = z.coerce.number().min(0).transform(r2).optional();
const oid = z.string().min(12);
const px = z.coerce.number().positive().transform((x) => Math.round(x * 1e4) / 1e4); // NAV / share price: 4dp
const owns = async (uid, id) => { if (id && !(await Account.exists({ _id: id, user: uid, deletedAt: null }))) throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND'); };

r.get('/summary', wrap(async (req, res) => ok(res, await portfolio(req.user.id))));

// ---- Mutual funds
const fundSchema = z.object({ name: z.string().min(1), amc: z.string().optional(), folio: z.string().optional(), nav: px.optional(), navDate: z.coerce.date().optional(), navSource: z.enum(['MANUAL', 'API', 'IMPORT']).optional() });
r.get('/funds', wrap(async (req, res) => {
  const pf = await portfolio(req.user.id);
  const txns = await MfTxn.find({ user: req.user.id }).sort({ date: -1 }).limit(100).lean();
  ok(res, { holdings: pf.mf.holdings, summary: { ...pf.mf, holdings: undefined }, transactions: txns });
}));
r.post('/funds/:id/transactions', wrap(async (req, res) => {
  const fund = await Fund.findOne({ _id: req.params.id, user: req.user.id });
  if (!fund) throw new AppError('Fund not found', 404, 'NOT_FOUND');
  const d = parse(z.object({ type: z.enum(['BUY', 'SELL', 'DIVIDEND']), date: z.coerce.date(), amount: money, nav: px.optional(), fees: optMoney, account: oid.optional() }), req.body);
  await owns(req.user.id, d.account);
  const nav = d.nav || n(fund.nav);
  if (d.type !== 'DIVIDEND' && !nav) throw new AppError('Enter the NAV', 422, 'VALIDATION_ERROR', { nav: 'Required' });
  const units = d.type === 'DIVIDEND' ? 0 : calculateUnits(d.amount, nav);
  let cashTxn;
  if (d.account) cashTxn = (await Transaction.create({ user: req.user.id, account: d.account, type: d.type === 'BUY' ? 'INVESTMENT' : 'INVESTMENT', flow: d.type === 'BUY' ? 'out' : 'in', amount: d.amount + (d.type === 'BUY' ? d.fees || 0 : 0), category: 'Mutual Fund', description: `${d.type} · ${fund.name}`, date: d.date }))._id;
  const tx = await MfTxn.create({ ...d, nav, units, user: req.user.id, fund: fund._id, cashTxn });
  if (d.nav && d.date >= (fund.navDate || 0)) { fund.nav = d.nav; fund.navDate = d.date; await fund.save(); }
  ok(res, tx.toObject(), 201);
}));
r.delete('/mf-transactions/:id', wrap(async (req, res) => {
  const t = await MfTxn.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (t?.cashTxn) await Transaction.deleteOne({ _id: t.cashTxn, user: req.user.id });
  ok(res, { deleted: true });
}));
// Existing holding: units + current NAV (+ optional total invested). Does not touch any cash account.
r.post('/funds/holding', wrap(async (req, res) => {
  const d = parse(z.object({
    name: z.string().min(1), amc: z.string().optional(), folio: z.string().optional(),
    units: z.coerce.number().positive().transform((x) => Math.round(x * 1e4) / 1e4), nav: px,
    invested: money.optional(), date: z.coerce.date().optional(),
  }), req.body);
  const esc = d.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let fund = await Fund.findOne({ user: req.user.id, name: new RegExp(`^${esc}$`, 'i') });
  if (!fund) fund = new Fund({ user: req.user.id, name: d.name.trim(), amc: d.amc, folio: d.folio });
  fund.nav = d.nav; fund.navDate = new Date(); fund.navSource = 'MANUAL';
  await fund.save();
  const invested = d.invested || r2(d.units * d.nav);
  const tx = await MfTxn.create({ user: req.user.id, fund: fund._id, type: 'BUY', date: d.date || new Date(), amount: invested, nav: Math.round((invested / d.units) * 1e4) / 1e4, units: d.units });
  ok(res, tx.toObject(), 201);
}));
// Edit a holding. Units / invested are reconciled with an ADJUSTMENT entry so the transaction history stays intact.
r.patch('/funds/:id/holding', wrap(async (req, res) => {
  const d = parse(z.object({
    name: z.string().min(1).optional(), amc: z.string().optional(), folio: z.string().optional(), nav: px.optional(),
    units: z.coerce.number().min(0).transform((x) => Math.round(x * 1e4) / 1e4).optional(), invested: z.coerce.number().min(0).transform(r2).optional(),
  }), req.body);
  const fund = await Fund.findOne({ _id: req.params.id, user: req.user.id });
  if (!fund) throw new AppError('Fund not found', 404, 'NOT_FOUND');
  for (const k of ['name', 'amc', 'folio']) if (d[k] !== undefined) fund[k] = d[k];
  if (d.nav) { fund.nav = d.nav; fund.navDate = new Date(); fund.navSource = 'MANUAL'; }
  const p = position(await MfTxn.find({ fund: fund._id, user: req.user.id }).lean());
  const du = d.units === undefined ? 0 : Math.round((d.units - p.units) * 1e4) / 1e4;
  const dc = d.invested === undefined ? 0 : r2(d.invested - p.cost);
  await fund.save();
  if (du || dc) await MfTxn.create({ user: req.user.id, fund: fund._id, type: 'ADJUSTMENT', date: new Date(), amount: dc, nav: fund.nav, units: du });
  ok(res, fund.toObject());
}));
r.delete('/funds/:id', wrap(async (req, res) => {
  if (await Sip.exists({ fund: req.params.id, user: req.user.id, status: { $ne: 'COMPLETED' } })) throw new AppError("Delete or complete this fund's SIP first", 409, 'HAS_SIP');
  const f = await Fund.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!f) throw new AppError('Fund not found', 404, 'NOT_FOUND');
  await Promise.all([MfTxn.deleteMany({ fund: f._id, user: req.user.id }), Sip.deleteMany({ fund: f._id, user: req.user.id })]);
  ok(res, { deleted: true });
}));
r.use('/funds', crud(Fund, fundSchema));

// ---- SIPs
const sipSchema = z.object({ fund: oid, account: oid, amount: money, dayOfMonth: z.coerce.number().min(1).max(28).optional(), startDate: z.coerce.date(), endDate: z.coerce.date().optional(), status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).optional() });
const sipFind = async (req) => { const s = await Sip.findOne({ _id: req.params.id, user: req.user.id }); if (!s) throw new AppError('SIP not found', 404, 'NOT_FOUND'); return s; };
r.get('/sips', wrap(async (req, res) => {
  const sips = await Sip.find({ user: req.user.id }).populate('fund', 'name').populate('account', 'name').sort({ createdAt: -1 }).lean();
  const stats = await MfTxn.aggregate([{ $match: { sip: { $in: sips.map((s) => s._id) } } }, { $group: { _id: '$sip', invested: { $sum: { $toDouble: '$amount' } }, units: { $sum: '$units' }, count: { $sum: 1 } } }]);
  ok(res, sips.map((s) => ({ ...s, ...(stats.find((x) => String(x._id) === String(s._id)) || { invested: 0, units: 0, count: 0 }), _id: s._id })));
}));
r.post('/sips', wrap(async (req, res) => {
  const d = parse(sipSchema, req.body);
  await owns(req.user.id, d.account);
  if (!(await Fund.exists({ _id: d.fund, user: req.user.id }))) throw new AppError('Fund not found', 404, 'NOT_FOUND');
  ok(res, (await Sip.create({ ...d, user: req.user.id, nextDate: d.startDate })).toObject(), 201);
}));
r.post('/sips/:id/execute', wrap(async (req, res) => {
  const s = await sipFind(req);
  const tx = await executeSip(s);
  s.nextDate = nextDate(s.nextDate > new Date() ? s.nextDate : new Date(), 'MONTHLY');
  await s.save();
  ok(res, tx.toObject(), 201);
}));
r.post('/sips/:id/pause', wrap(async (req, res) => { const s = await sipFind(req); s.status = 'PAUSED'; await s.save(); ok(res, s.toObject()); }));
r.post('/sips/:id/resume', wrap(async (req, res) => { const s = await sipFind(req); s.status = 'ACTIVE'; await s.save(); ok(res, s.toObject()); }));
r.delete('/sips/:id', wrap(async (req, res) => { await (await sipFind(req)).deleteOne(); ok(res, { deleted: true }); }));

// ---- Stocks: market US (USD) or IN (INR)
const mkt = z.enum(['US', 'IN']);
const sym = z.string().min(1).max(20).transform((x) => x.trim().toUpperCase());
r.get('/stocks', wrap(async (req, res) => {
  const market = req.query.market === 'IN' ? 'IN' : 'US';
  const pf = await portfolio(req.user.id);
  const book = market === 'IN' ? pf.in : pf.us;
  const transactions = await StockTxn.find({ user: req.user.id, market: market === 'IN' ? 'IN' : { $ne: 'IN' } }).sort({ date: -1 }).limit(30).lean();
  ok(res, { market, holdings: book.holdings, summary: { ...book, holdings: undefined }, usdInr: pf.usdInr, transactions });
}));
// Existing holding: shares + current price (+ optional total invested)
r.post('/stocks/holding', wrap(async (req, res) => {
  const d = parse(z.object({ market: mkt, ticker: sym, shares: z.coerce.number().positive(), price: px, invested: money.optional(), fxRate: z.coerce.number().positive().optional(), date: z.coerce.date().optional() }), req.body);
  const user = await User.findById(req.user.id).lean();
  const avg = d.invested ? Math.round((d.invested / d.shares) * 1e4) / 1e4 : d.price;
  const tx = await StockTxn.create({ user: req.user.id, market: d.market, ticker: d.ticker, type: 'BUY', shares: d.shares, price: avg, fees: 0, tax: 0, fxRate: d.market === 'IN' ? 1 : d.fxRate || user.usdInr, date: d.date || new Date() });
  await StockPrice.findOneAndUpdate({ user: req.user.id, market: d.market, ticker: d.ticker }, { price: d.price }, { upsert: true });
  ok(res, tx.toObject(), 201);
}));
r.patch('/stocks/holding', wrap(async (req, res) => {
  const d = parse(z.object({
    market: mkt, ticker: sym, newTicker: sym.optional(), shares: z.coerce.number().min(0).optional(), price: px.optional(),
    invested: z.coerce.number().min(0).transform(r2).optional(), fxRate: z.coerce.number().positive().optional(),
  }), req.body);
  const user = await User.findById(req.user.id).lean();
  const pf = await portfolio(req.user.id);
  const book = d.market === 'IN' ? pf.in : pf.us;
  const h = book.holdings.find((x) => x.ticker === d.ticker);
  if (!h) throw new AppError('Holding not found', 404, 'NOT_FOUND');
  const base = { user: req.user.id, market: d.market };
  let tk = d.ticker;
  if (d.newTicker && d.newTicker !== d.ticker) {
    if (book.holdings.some((x) => x.ticker === d.newTicker)) throw new AppError('You already hold that symbol', 409, 'DUPLICATE', { ticker: 'Already exists' });
    await StockTxn.updateMany({ ...base, ticker: d.ticker }, { ticker: d.newTicker });
    await StockPrice.updateMany({ ...base, ticker: d.ticker }, { ticker: d.newTicker });
    tk = d.newTicker;
  }
  const du = d.shares === undefined ? 0 : Math.round((d.shares - h.shares) * 1e4) / 1e4;
  const dc = d.invested === undefined ? 0 : r2(d.invested - h.cost);
  if (du || dc) await StockTxn.create({ ...base, ticker: tk, type: 'ADJUSTMENT', shares: du, amount: dc, price: 0, fxRate: d.market === 'IN' ? 1 : d.fxRate || h.avgFx || user.usdInr, date: new Date() });
  if (d.price) await StockPrice.findOneAndUpdate({ ...base, ticker: tk }, { price: d.price }, { upsert: true });
  ok(res, { updated: true });
}));
r.delete('/stocks/holding', wrap(async (req, res) => {
  const market = req.query.market === 'IN' ? 'IN' : 'US';
  const ticker = String(req.query.ticker || '').trim().toUpperCase();
  if (!ticker) throw new AppError('Symbol required', 422, 'VALIDATION_ERROR');
  await Promise.all([StockTxn.deleteMany({ user: req.user.id, market, ticker }), StockPrice.deleteMany({ user: req.user.id, market, ticker })]);
  ok(res, { deleted: true });
}));
r.post('/stocks/transactions', wrap(async (req, res) => {
  const d = parse(z.object({
    market: mkt.optional(), ticker: sym, type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'BONUS']),
    shares: z.coerce.number().min(0).optional(), price: px.optional(), fees: optMoney, tax: optMoney,
    fxRate: z.coerce.number().positive().optional(), date: z.coerce.date(),
  }), req.body);
  const market = d.market || 'US';
  const user = await User.findById(req.user.id).lean();
  const tx = await StockTxn.create({ ...d, market, fxRate: market === 'IN' ? 1 : d.fxRate || user.usdInr, user: req.user.id });
  if (d.type === 'BUY' || d.type === 'SELL')
    await StockPrice.updateOne({ user: req.user.id, market, ticker: d.ticker }, { $setOnInsert: { price: d.price } }, { upsert: true });
  ok(res, tx.toObject(), 201);
}));
r.delete('/stocks/transactions/:id', wrap(async (req, res) => { await StockTxn.deleteOne({ _id: req.params.id, user: req.user.id }); ok(res, { deleted: true }); }));
r.put('/stocks/prices', wrap(async (req, res) => {
  const d = parse(z.object({ market: mkt.optional(), ticker: sym, price: px }), req.body);
  ok(res, await StockPrice.findOneAndUpdate({ user: req.user.id, market: d.market || 'US', ticker: d.ticker }, { price: d.price }, { upsert: true, returnDocument: 'after' }).lean());
}));
export default r;
