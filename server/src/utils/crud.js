import { Router } from 'express';
import { wrap, ok, parse, AppError } from './http.js';

// Every query is scoped by req.user.id (never trusted from the client body).
export function crud(Model, schema, { soft = false, sort = { createdAt: -1 }, pre, populate } = {}) {
  const r = Router();
  const base = (req) => ({ user: req.user.id, ...(soft ? { deletedAt: null } : {}) });
  r.get('/', wrap(async (req, res) => {
    let q = Model.find(base(req)).sort(sort);
    if (populate) q = q.populate(populate);
    ok(res, await q.lean());
  }));
  r.post('/', wrap(async (req, res) => {
    let d = parse(schema, req.body);
    if (pre) d = await pre(req, d, false);
    const doc = await Model.create({ ...d, user: req.user.id });
    ok(res, doc.toObject(), 201);
  }));
  r.patch('/:id', wrap(async (req, res) => {
    let d = parse(schema.partial(), req.body);
    if (pre) d = await pre(req, d, true);
    const doc = await Model.findOneAndUpdate({ ...base(req), _id: req.params.id }, d, { returnDocument: 'after' }).lean();
    if (!doc) throw new AppError('Not found', 404, 'NOT_FOUND');
    ok(res, doc);
  }));
  r.delete('/:id', wrap(async (req, res) => {
    const q = { ...base(req), _id: req.params.id };
    const doc = soft ? await Model.findOneAndUpdate(q, { deletedAt: new Date() }) : await Model.findOneAndDelete(q);
    if (!doc) throw new AppError('Not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  }));
  return r;
}
