import { Router } from 'express';
import { wrap, ok } from '../utils/http.js';
import { dashboard } from '../services/finance.js';
import { runDue } from '../services/recurring.js';
const r = Router();
r.get('/', wrap(async (req, res) => {
  await runDue(req.user.id).catch((e) => console.error('[runDue]', e)); // SIPs & recurring never depend on the cron alone
  ok(res, await dashboard(req.user.id, req.query.month));
}));
export default r;
