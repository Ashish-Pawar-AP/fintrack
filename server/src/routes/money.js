import { Router } from 'express';
import { z } from 'zod';
import { Account, Transaction, Category, Recurring, Budget, MfTxn, StockTxn } from '../models/index.js';
import { wrap, ok, parse, AppError } from '../utils/http.js';
import { crud } from '../utils/crud.js';
import { r2, n } from '../utils/engine.js';
import { loadAll, balancesAt } from '../services/finance.js';
import { runDue } from '../services/recurring.js';

const r = Router();
const money = z.coerce.number().positive().max(1e12).transform(r2);
const signed = z.coerce.number().refine((x) => x !== 0, 'Cannot be zero').transform(r2);
const oid = z.string().min(12);

export const DEFAULT_CATS = {
  INCOME: ['Salary', 'Freelance', 'Business', 'Bonus', 'Interest', 'Dividend', 'Cashback', 'Rental Income', 'Gift', 'Other'],
  EXPENSE: ['Rent', 'Maintenance', 'Electricity', 'Water', 'Gas', 'Internet', 'Groceries', 'Restaurants', 'Food Delivery', 'Coffee', 'Fuel', 'Public Transport', 'Taxi', 'Parking', 'Vehicle Maintenance', 'Shopping', 'Entertainment', 'Gaming', 'Subscriptions', 'Gym', 'Travel', 'Insurance', 'Loan Payment', 'Bank Fees', 'Taxes', 'Education', 'Medical', 'Gifts', 'Miscellaneous'],
};

const owns = async (uid, ...ids) => {
  for (const id of ids.filter(Boolean))
    if (!(await Account.exists({ _id: id, user: uid, deletedAt: null }))) throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
};

// ---- Accounts (with calculated balance)
const accountSchema = z.object({
  name: z.string().min(1), institution: z.string().optional(), type: z.string().optional(), currency: z.string().optional(),
  openingBalance: z.coerce.number().transform(r2), openingDate: z.coerce.date().optional(), last4: z.string().regex(/^\d{4}$/, '4 digits').optional(),
});
r.get('/accounts', wrap(async (req, res) => {
  const { accs, txns } = await loadAll(req.user.id);
  ok(res, balancesAt(accs, txns));
}));
r.use('/accounts', crud(Account, accountSchema, { soft: true }));

// ---- Categories
r.get('/categories', wrap(async (req, res) => {
  const custom = await Category.find({ user: req.user.id }).lean();
  ok(res, ['INCOME', 'EXPENSE'].reduce((o, t) => ({ ...o, [t]: [...DEFAULT_CATS[t], ...custom.filter((c) => c.type === t).map((c) => c.name)] }), {}));
}));
r.post('/categories', wrap(async (req, res) => {
  const d = parse(z.object({ name: z.string().min(1), type: z.enum(['INCOME', 'EXPENSE']) }), req.body);
  ok(res, await Category.create({ ...d, user: req.user.id }), 201);
}));

// ---- Transactions
const txSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT', 'REFUND', 'ADJUSTMENT']),
  account: oid, toAccount: oid.optional(), amount: signed, category: z.string().optional(),
  description: z.string().optional(), merchant: z.string().optional(), date: z.coerce.date().optional(), flow: z.enum(['in', 'out']).optional(),
});
const txPre = async (req, d) => {
  await owns(req.user.id, d.account, d.toAccount);
  if (d.type === 'TRANSFER') {
    if (!d.toAccount) throw new AppError('Choose a destination account', 422, 'VALIDATION_ERROR', { toAccount: 'Required' });
    if (d.toAccount === d.account) throw new AppError('Accounts must differ', 422, 'VALIDATION_ERROR', { toAccount: 'Must differ' });
  }
  if (d.type && d.type !== 'ADJUSTMENT' && d.amount < 0) throw new AppError('Amount must be greater than zero', 422, 'VALIDATION_ERROR', { amount: 'Must be positive' });
  return d;
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function txQuery(req) {
  const q = req.query, f = { user: req.user.id, deletedAt: null };
  if (q.from || q.to) f.date = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  if (q.type) f.type = q.type;
  if (q.category) f.category = q.category;
  if (q.account) f.$or = [{ account: q.account }, { toAccount: q.account }];
  if (q.minAmount || q.maxAmount) f.amount = { ...(q.minAmount && { $gte: Number(q.minAmount) }), ...(q.maxAmount && { $lte: Number(q.maxAmount) }) };
  if (q.search) { const re = new RegExp(esc(String(q.search)), 'i'); f.$and = [{ $or: [{ description: re }, { merchant: re }, { category: re }] }]; }
  return f;
}
r.get('/transactions/export', wrap(async (req, res) => {
  const rows = await Transaction.find(txQuery(req)).sort({ date: -1 }).populate('account', 'name').lean();
  const csv = ['Date,Type,Category,Account,Amount,Description,Merchant']
    .concat(rows.map((t) => [new Date(t.date).toISOString().slice(0, 10), t.type, t.category || '', t.account?.name || '', n(t.amount), t.description || '', t.merchant || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv').setHeader('Content-Disposition', 'attachment; filename="transactions.csv"').send(csv);
}));
r.get('/transactions', wrap(async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(100, +req.query.limit || 20);
  const f = txQuery(req);
  const [items, total] = await Promise.all([
    Transaction.find(f).sort({ date: req.query.sort === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(limit).populate('account', 'name').populate('toAccount', 'name').lean(),
    Transaction.countDocuments(f),
  ]);
  ok(res, { items, total, page, pages: Math.ceil(total / limit) });
}));
r.use('/transactions', crud(Transaction, txSchema, { soft: true, pre: txPre }));

// ---- Recurring
const recSchema = z.object({
  account: oid, type: z.enum(['INCOME', 'EXPENSE']), amount: money, category: z.string().optional(), description: z.string().min(1),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(), startDate: z.coerce.date(), endDate: z.coerce.date().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(), autoCreate: z.boolean().optional(),
});
r.post('/recurring/run', wrap(async (req, res) => ok(res, { created: await runDue(req.user.id) })));
r.use('/recurring', crud(Recurring, recSchema, {
  sort: { nextOccurrence: 1 },
  pre: async (req, d, patch) => { if (d.account) await owns(req.user.id, d.account); if (!patch) d.nextOccurrence = d.startDate; return d; },
}));

// ---- Budgets
r.get('/budgets', wrap(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const [budgets, spent] = await Promise.all([
    Budget.find({ user: req.user.id, month }).lean(),
    Transaction.aggregate([
      { $match: { user: new (await import('mongoose')).default.Types.ObjectId(req.user.id), deletedAt: null, type: 'EXPENSE', date: { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) } } },
      { $group: { _id: '$category', total: { $sum: { $toDouble: '$amount' } } } },
    ]),
  ]);
  const sp = Object.fromEntries(spent.map((s) => [s._id, s.total]));
  ok(res, budgets.map((b) => ({ _id: b._id, category: b.category, month, budget: n(b.amount), spent: r2(sp[b.category] || 0), pct: n(b.amount) ? r2(((sp[b.category] || 0) / n(b.amount)) * 100) : 0 })));
}));
r.put('/budgets', wrap(async (req, res) => {
  const d = parse(z.object({ category: z.string().min(1), month: z.string().regex(/^\d{4}-\d{2}$/), amount: money }), req.body);
  ok(res, await Budget.findOneAndUpdate({ user: req.user.id, category: d.category, month: d.month }, d, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }).lean());
}));
r.delete('/budgets/:id', wrap(async (req, res) => { await Budget.deleteOne({ _id: req.params.id, user: req.user.id }); ok(res, { deleted: true }); }));

export default r;
