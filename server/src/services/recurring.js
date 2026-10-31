import { Recurring, Sip, Transaction } from '../models/index.js';
import { nextDate } from '../utils/engine.js';
import { executeSip } from './finance.js';

// Materialises due recurring rules and SIPs. Safe to call repeatedly (idempotent per due date).
export async function runDue(userId = null, now = new Date()) {
  const scope = userId ? { user: userId } : {};
  let created = 0;
  for (const r of await Recurring.find({ ...scope, status: 'ACTIVE', autoCreate: true, nextOccurrence: { $lte: now } })) {
    for (let g = 0; r.nextOccurrence <= now && g < 60; g++) {
      if (r.endDate && r.nextOccurrence > r.endDate) break;
      try {
        await Transaction.create({ user: r.user, account: r.account, type: r.type, amount: r.amount, category: r.category, description: r.description, date: r.nextOccurrence, recurring: r._id });
        created++;
      } catch (e) {
        if (e.code !== 11000) throw e; // already generated for this date: just move on
      }
      r.nextOccurrence = nextDate(r.nextOccurrence, r.frequency, r.interval);
    }
    if (r.endDate && r.nextOccurrence > r.endDate) r.status = 'COMPLETED';
    await r.save();
  }
  for (const s of await Sip.find({ ...scope, status: 'ACTIVE', nextDate: { $lte: now } })) {
    for (let g = 0; s.nextDate <= now && g < 60; g++) {
      if (s.endDate && s.nextDate > s.endDate) break;
      try { await executeSip(s, s.nextDate); created++; } catch (e) { if (e.code !== 11000) break; } // 11000 = instalment already exists
      s.nextDate = nextDate(s.nextDate, 'MONTHLY');
    }
    if (s.endDate && s.nextDate > s.endDate) s.status = 'COMPLETED';
    await s.save();
  }
  return created;
}
