import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { config } from './config.js';
import auth from './routes/auth.js';
import money from './routes/money.js';
import goals from './routes/goals.js';
import investments from './routes/investments.js';
import dashboard from './routes/dashboard.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { AppError } from './utils/http.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(compression());
if (config.clientUrl) app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '200kb' }));
// NoSQL-injection guard (Express 5 makes req.query read-only, so sanitise body/params ourselves)
const clean = (o) => {
  if (!o || typeof o !== 'object') return o;
  for (const k of Object.keys(o)) {
    if (k.startsWith('$') || k.includes('.')) delete o[k];
    else clean(o[k]);
  }
  return o;
};
app.use((req, _res, next) => { clean(req.body); clean(req.params); for (const k of Object.keys(req.query)) if (typeof req.query[k] === 'object') return next(new AppError('Invalid query', 400, 'BAD_QUERY')); next(); });
app.use(cookieParser());
app.use(morgan(config.prod ? 'combined' : 'tiny'));

app.get('/healthz', (_q, r) => r.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ ok: mongoose.connection.readyState === 1 }));

// CSRF defence-in-depth for cookie-authenticated endpoints (the refresh cookie is also SameSite=Lax).
// Only enforced in production: behind dev proxies the Host header is rewritten, which caused false "bad origin" errors.
// Allowed: CLIENT_URL, anything in ALLOWED_ORIGINS (comma separated), or the same host the request was sent to.
const allowedOrigins = [config.clientUrl, ...(process.env.ALLOWED_ORIGINS || '').split(',')].map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);
app.use('/api/v1/auth', (req, _res, next) => {
  if (!config.prod || req.method === 'GET') return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  let ok = allowedOrigins.includes(origin);
  try {
    const host = new URL(origin).host;
    ok = ok || [req.get('host'), req.get('x-forwarded-host')].some((h) => h && h.split(',')[0].trim() === host);
  } catch { ok = false; }
  return ok ? next() : next(new AppError(`Origin not allowed: ${origin}. Set CLIENT_URL or ALLOWED_ORIGINS to this origin.`, 403, 'BAD_ORIGIN'));
});

app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/v1/auth', auth);
app.use('/api/v1', requireAuth);
app.use('/api/v1', money);
app.use('/api/v1/goals', goals);
app.use('/api/v1/investments', investments);
app.use('/api/v1/dashboard', dashboard);
app.use('/api', (_q, _r, next) => next(new AppError('Route not found', 404, 'NOT_FOUND')));

// Serve the built React app (single-origin deployment)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1y', index: false, setHeaders: (res, p) => p.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next())); // SPA fallback (Express 5 safe)
}
app.use(errorHandler);
export default app;
