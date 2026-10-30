import { config } from '../config.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { wrap, ok, parse, AppError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { sendMail } from '../utils/mailer.js';

const r = Router();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/v1/auth', maxAge: 30 * 864e5 };
const access = (id) => jwt.sign({ sub: String(id) }, process.env.JWT_SECRET, { expiresIn: '15m' });

async function issue(res, userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  await User.updateOne({ _id: userId }, { $pull: { refreshTokens: { expires: { $lt: new Date() } } } });
  await User.updateOne({ _id: userId }, { $push: { refreshTokens: { $each: [{ hash: sha(raw), expires: new Date(Date.now() + 30 * 864e5) }], $slice: -10 } } });
  res.cookie('rt', raw, cookieOpts);
  return access(userId);
}
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, baseCurrency: u.baseCurrency, country: u.country, timezone: u.timezone, usdInr: u.usdInr });
const loginLimit = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a minute.' } } });

r.post('/register', wrap(async (req, res) => {
  const d = parse(z.object({
    name: z.string().min(2), email: z.string().email(), password: z.string().min(8, 'Use at least 8 characters'),
    country: z.string().optional(), timezone: z.string().optional(),
  }), req.body);
  if (await User.exists({ email: d.email.toLowerCase() })) throw new AppError('Email already registered', 409, 'EMAIL_TAKEN', { email: 'Already registered' });
  const user = await User.create({ ...d, passwordHash: await bcrypt.hash(d.password, 12) });
  ok(res, { accessToken: await issue(res, user._id), user: pub(user) }, 201);
}));

r.post('/login', loginLimit, wrap(async (req, res) => {
  const d = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
  const user = await User.findOne({ email: d.email.toLowerCase() });
  if (!user || !(await bcrypt.compare(d.password, user.passwordHash))) throw new AppError('Incorrect email or password', 401, 'INVALID_CREDENTIALS');
  ok(res, { accessToken: await issue(res, user._id), user: pub(user) });
}));

// Rotating refresh token: old token is consumed, a new one is issued.
// Rotating refresh token. The old token stays valid for a 60s grace window so parallel requests
// (StrictMode double-mount, several 401s at once, a second tab) never lose their session.
r.post('/refresh', wrap(async (req, res) => {
  const raw = req.cookies?.rt;
  if (!raw) throw new AppError('No session', 401, 'NO_SESSION');
  const h = sha(raw), now = new Date();
  const user = await User.findOne({ refreshTokens: { $elemMatch: { hash: h, expires: { $gt: now } } } });
  if (!user) throw new AppError('Session expired', 401, 'SESSION_EXPIRED');
  const grace = new Date(now.getTime() + 60_000);
  await User.updateOne({ _id: user._id }, { $set: { 'refreshTokens.$[t].expires': grace } }, { arrayFilters: [{ 't.hash': h, 't.expires': { $gt: grace } }] });
  ok(res, { accessToken: await issue(res, user._id), user: pub(user) });
}));

const forgotLimit = rateLimit({ windowMs: 3600_000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Try again in an hour.' } } });

// Always answers the same way, so it cannot be used to discover which emails are registered.
r.post('/forgot-password', forgotLimit, wrap(async (req, res) => {
  const d = parse(z.object({ email: z.string().email() }), req.body);
  const user = await User.findOne({ email: d.email.toLowerCase() });
  if (user) {
    const raw = crypto.randomBytes(32).toString('hex');
    await User.updateOne({ _id: user._id }, { resetHash: sha(raw), resetExpires: new Date(Date.now() + 30 * 60_000) });
    const link = `${config.appUrl.replace(/\/$/, '')}/reset-password?token=${raw}`;
    sendMail({ to: user.email, subject: 'Reset your FinTrack password', text: `Use this link to choose a new password (valid for 30 minutes):\n\n${link}\n\nIf you did not ask for this, you can ignore this email.` })
      .catch((e) => console.error('[mail]', e.message));
  }
  ok(res, { sent: true });
}));

r.post('/reset-password', wrap(async (req, res) => {
  const d = parse(z.object({ token: z.string().min(20), password: z.string().min(8, 'Use at least 8 characters') }), req.body);
  const user = await User.findOne({ resetHash: sha(d.token), resetExpires: { $gt: new Date() } });
  if (!user) throw new AppError('This reset link is invalid or has expired', 400, 'INVALID_RESET_TOKEN');
  // New password, single-use token, and every existing session signed out.
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(d.password, 12), refreshTokens: [] }, $unset: { resetHash: '', resetExpires: '' } });
  res.clearCookie('rt', cookieOpts);
  ok(res, { reset: true });
}));

r.post('/logout', wrap(async (req, res) => {
  const raw = req.cookies?.rt;
  if (raw) await User.updateOne({ 'refreshTokens.hash': sha(raw) }, { $pull: { refreshTokens: { hash: sha(raw) } } });
  res.clearCookie('rt', cookieOpts);
  ok(res, { loggedOut: true });
}));

r.post('/logout-all', requireAuth, wrap(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $set: { refreshTokens: [] } });
  res.clearCookie('rt', cookieOpts);
  ok(res, { loggedOut: true });
}));

r.get('/me', requireAuth, wrap(async (req, res) => ok(res, pub(await User.findById(req.user.id)))));
r.patch('/me', requireAuth, wrap(async (req, res) => {
  const d = parse(z.object({ name: z.string().min(2), usdInr: z.coerce.number().positive(), timezone: z.string() }).partial(), req.body);
  ok(res, pub(await User.findByIdAndUpdate(req.user.id, d, { returnDocument: 'after' })));
}));
export default r;
