export function errorHandler(err, req, res, _next) {
  let { status = 500, code = 'INTERNAL_ERROR', message, fields } = err;
  if (err.name === 'CastError') { status = 400; code = 'INVALID_ID'; message = 'Invalid identifier'; }
  if (err.code === 11000) { status = 409; code = 'DUPLICATE'; message = 'That record already exists'; }
  if (status >= 500) { console.error(`[${req.method} ${req.originalUrl}]`, err); message = 'Something went wrong. Please try again.'; }
  res.status(status).json({ success: false, error: { code, message, fields } });
}
