import { Router } from 'express';
import { z } from 'zod';
import { Goal } from '../models/index.js';
import { wrap, ok, parse, AppError } from '../utils/http.js';
import { goalStats, r2 } from '../utils/engine.js';

const r = Router();
const money = z.coerce.number().positive().transform(r2);
const schema = z.object({
  name: z.string().min(1), targetAmount: money, targetDate: z.coerce.date().optional(), startDate: z.coerce.date().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(), category: z.string().optional(), description: z.string().optional(), paused: z.boolean().optional(),
});
const shape = (g) => ({ ...g, ...goalStats(g, g.contributions || []) });
const find = async (req) => {
  const g = await Goal.findOne({ _id: req.params.id, user: req.user.id });
  if (!g) throw new AppError('Goal not found', 404, 'NOT_FOUND');
  return g;
};

r.get('/', wrap(async (req, res) => ok(res, (await Goal.find({ user: req.user.id }).sort({ createdAt: -1 }).lean()).map(shape))));
r.post('/', wrap(async (req, res) => ok(res, shape((await Goal.create({ ...parse(schema, req.body), user: req.user.id })).toObject()), 201)));
r.patch('/:id', wrap(async (req, res) => {
  const g = await find(req);
  g.set(parse(schema.partial(), req.body));
  await g.save();
  ok(res, shape(g.toObject()));
}));
r.delete('/:id', wrap(async (req, res) => { await (await find(req)).deleteOne(); ok(res, { deleted: true }); }));
r.post('/:id/contributions', wrap(async (req, res) => {
  const g = await find(req);
  g.contributions.push(parse(z.object({ amount: money, date: z.coerce.date().optional(), note: z.string().optional() }), req.body));
  await g.save();
  ok(res, shape(g.toObject()), 201);
}));
r.get('/:id/progress', wrap(async (req, res) => ok(res, shape((await find(req)).toObject()))));
export default r;
