import mongoose from 'mongoose';
const { Schema } = mongoose;
const D = { type: Schema.Types.Decimal128, default: 0 };
const ref = (m, extra = {}) => ({ type: Schema.Types.ObjectId, ref: m, ...extra });
const mk = (name, def, idx = []) => {
  const s = new Schema(def, { timestamps: true });
  idx.forEach((i) => s.index(...i));
  return mongoose.model(name, s);
};

export const User = mk('User', {
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  country: { type: String, default: 'IN' },
  baseCurrency: { type: String, default: 'INR' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  usdInr: { type: Number, default: 90 },
  refreshTokens: [{ hash: String, expires: Date }],
  resetHash: String,     // SHA-256 of the password-reset token
  resetExpires: Date,
});

export const Account = mk('Account', {
  user: ref('User', { required: true, index: true }),
  name: { type: String, required: true },
  institution: String,
  type: { type: String, default: 'Savings Account' },
  currency: { type: String, default: 'INR' },
  openingBalance: D,
  openingDate: { type: Date, default: Date.now },
  last4: String,
  deletedAt: { type: Date, default: null },
});

export const Category = mk('Category', {
  user: ref('User', { required: true, index: true }),
  name: { type: String, required: true },
  type: { type: String, enum: ['INCOME', 'EXPENSE'], required: true },
});

export const Transaction = mk('Transaction', {
  user: ref('User', { required: true }),
  account: ref('Account', { required: true }),
  toAccount: ref('Account'),
  type: { type: String, enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT', 'REFUND', 'ADJUSTMENT'], required: true },
  flow: { type: String, enum: ['in', 'out'], default: 'out' }, // INVESTMENT only
  amount: { ...D, required: true },
  currency: { type: String, default: 'INR' },
  category: String,
  description: String,
  merchant: String,
  date: { type: Date, required: true, default: Date.now },
  tags: [String],
  recurring: ref('Recurring'),
  deletedAt: { type: Date, default: null },
}, [[{ user: 1, date: -1 }], [{ user: 1, category: 1 }], [{ user: 1, account: 1 }],
  // a recurring rule can create at most one transaction per due date
  [{ recurring: 1, date: 1 }, { unique: true, partialFilterExpression: { recurring: { $type: 'objectId' } } }]]);

export const Recurring = mk('Recurring', {
  user: ref('User', { required: true, index: true }),
  account: ref('Account', { required: true }),
  type: { type: String, enum: ['INCOME', 'EXPENSE'], required: true },
  amount: { ...D, required: true },
  category: String,
  description: { type: String, required: true },
  frequency: { type: String, enum: ['WEEKLY', 'MONTHLY', 'YEARLY'], default: 'MONTHLY' },
  interval: { type: Number, default: 1 },
  startDate: { type: Date, required: true },
  endDate: Date,
  nextOccurrence: { type: Date, required: true },
  status: { type: String, enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
  autoCreate: { type: Boolean, default: true },
}, [[{ user: 1, nextOccurrence: 1 }]]);

export const Budget = mk('Budget', {
  user: ref('User', { required: true }),
  category: { type: String, required: true },
  month: { type: String, required: true }, // YYYY-MM
  amount: { ...D, required: true },
}, [[{ user: 1, category: 1, month: 1 }, { unique: true }]]);

export const Goal = mk('Goal', {
  user: ref('User', { required: true, index: true }),
  name: { type: String, required: true },
  targetAmount: { ...D, required: true },
  startDate: { type: Date, default: Date.now },
  targetDate: Date,
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  category: { type: String, default: 'Custom' },
  description: String,
  paused: { type: Boolean, default: false },
  contributions: [{ amount: D, date: { type: Date, default: Date.now }, note: String }],
});

export const Fund = mk('Fund', {
  user: ref('User', { required: true, index: true }),
  name: { type: String, required: true },
  amc: String,
  folio: String,
  nav: D,
  navDate: { type: Date, default: Date.now },
  navSource: { type: String, enum: ['MANUAL', 'API', 'IMPORT'], default: 'MANUAL' },
});

export const MfTxn = mk('MfTxn', {
  user: ref('User', { required: true, index: true }),
  fund: ref('Fund', { required: true, index: true }),
  type: { type: String, enum: ['BUY', 'SELL', 'DIVIDEND', 'ADJUSTMENT'], required: true },
  date: { type: Date, required: true },
  amount: D, nav: D, units: { type: Number, default: 0 }, fees: D,
  cashTxn: ref('Transaction'),
  sip: ref('Sip'),
}, [[{ sip: 1, date: 1 }, { unique: true, partialFilterExpression: { sip: { $type: 'objectId' } } }]]); // one entry per SIP instalment date

export const Sip = mk('Sip', {
  user: ref('User', { required: true, index: true }),
  fund: ref('Fund', { required: true }),
  account: ref('Account', { required: true }),
  amount: { ...D, required: true },
  frequency: { type: String, default: 'MONTHLY' },
  dayOfMonth: Number,
  startDate: { type: Date, required: true },
  endDate: Date,
  nextDate: { type: Date, required: true },
  status: { type: String, enum: ['ACTIVE', 'PAUSED', 'COMPLETED'], default: 'ACTIVE' },
});

export const StockTxn = mk('StockTxn', {
  user: ref('User', { required: true, index: true }),
  market: { type: String, enum: ['US', 'IN'], default: 'US' },
  ticker: { type: String, required: true, uppercase: true, index: true },
  type: { type: String, enum: ['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'BONUS', 'ADJUSTMENT'], required: true },
  shares: { type: Number, default: 0 },
  price: D, fees: D, tax: D,
  amount: D, // explicit cost, used by ADJUSTMENT (manual edits)
  fxRate: { type: Number, default: 90 }, // USD/INR on trade date
  date: { type: Date, required: true },
  account: ref('Account'),
  cashTxn: ref('Transaction'),
});

export const StockPrice = mk('StockPrice', {
  user: ref('User', { required: true }),
  market: { type: String, enum: ['US', 'IN'], default: 'US' },
  ticker: { type: String, uppercase: true, required: true },
  price: D,
}, [[{ user: 1, market: 1, ticker: 1 }, { unique: true }]]);
