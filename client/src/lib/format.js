const nf = (cur) => new Intl.NumberFormat(cur === 'USD' ? 'en-US' : 'en-IN', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'USD' ? 2 : 0 });
const f = { INR: nf('INR'), USD: nf('USD') };
export const money = (v = 0, cur = 'INR') => f[cur].format(v || 0);
export const compact = (v = 0, cur = '₹') => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}${cur}${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}${cur}${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}${cur}${(a / 1e3).toFixed(1)}K`;
  return `${s}${cur}${Math.round(a)}`;
};
export const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
export const dt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
export const isoDay = (d = new Date()) => new Date(d).toISOString().slice(0, 10);
export const monthKey = (d = new Date()) => new Date(d).toISOString().slice(0, 7);
