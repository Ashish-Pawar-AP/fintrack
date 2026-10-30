import jwt from 'jsonwebtoken';
import { AppError } from '../utils/http.js';
export function requireAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return next(new AppError('Please sign in', 401, 'UNAUTHENTICATED'));
  try {
    req.user = { id: jwt.verify(h.slice(7), process.env.JWT_SECRET).sub };
    next();
  } catch {
    next(new AppError('Session expired', 401, 'TOKEN_EXPIRED'));
  }
}
