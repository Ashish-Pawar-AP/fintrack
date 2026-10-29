export class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST', fields) {
    super(message); this.status = status; this.code = code; this.fields = fields;
  }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Decimal128 -> Number on the way out
export const plain = (d) =>
  JSON.parse(JSON.stringify(d, (k, v) => (v && typeof v === 'object' && v.$numberDecimal !== undefined ? parseFloat(v.$numberDecimal) : v)));
export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data: plain(data) });
export const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = {};
    r.error.issues.forEach((i) => (fields[i.path.join('.') || '_'] = i.message));
    throw new AppError('Please check the highlighted fields', 422, 'VALIDATION_ERROR', fields);
  }
  return r.data;
};
