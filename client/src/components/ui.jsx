import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { X, LoaderCircle, Inbox, CircleCheck, TriangleAlert } from 'lucide-react';
import { Select, DatePicker, MonthPicker } from './pickers';

export const cn = (...a) => a.filter(Boolean).join(' ');
export const ease = [0.16, 1, 0.3, 1];
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
export const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } } };

export function Page({ children, className }) {
  return <motion.div variants={stagger} initial="hidden" animate="show" className={cn('space-y-5', className)}>{children}</motion.div>;
}

export function Card({ className, children, ...p }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
  };
  return <motion.div variants={rise} onMouseMove={onMove} className={cn('card', className)} {...p}>{children}</motion.div>;
}

export function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-900">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute -left-24 top-0 h-[28rem] w-[28rem] animate-float1 rounded-full bg-brand/20 blur-[110px]" />
      <div className="absolute -right-20 top-1/3 h-[26rem] w-[26rem] animate-float2 rounded-full bg-gain/10 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] animate-float1 rounded-full bg-indigo-500/10 blur-[110px]" />
    </div>
  );
}

export function CountUp({ value = 0, format = (v) => Math.round(v).toLocaleString('en-IN') }) {
  const ref = useRef(null), prev = useRef(0);
  useEffect(() => {
    const c = animate(prev.current, value, { duration: 1.1, ease, onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); } });
    prev.current = value;
    return () => c.stop();
  }, [value]); // eslint-disable-line
  return <span ref={ref}>{format(0)}</span>;
}

export function Skeleton({ className }) { return <div className={cn('skeleton', className)} />; }
export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    </div>
  );
}

export function Progress({ value = 0, tone = 'brand', className }) {
  const col = { brand: 'from-brand to-brand-soft', gain: 'from-emerald-500 to-gain', loss: 'from-red-500 to-loss', warn: 'from-amber-500 to-warn' }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={cn('h-2 overflow-hidden rounded-full bg-white/[0.07]', className)}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 1, ease }} className={cn('h-full rounded-full bg-linear-to-r', col)} />
    </div>
  );
}

export function Ring({ value = 0, size = 76, stroke = 7, tone = '#3B82F6', children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }} transition={{ duration: 1.2, ease }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold num">{children}</div>
    </div>
  );
}

const tones = { gain: 'bg-gain/10 text-gain border-gain/25', loss: 'bg-loss/10 text-loss border-loss/25', warn: 'bg-warn/10 text-warn border-warn/25', brand: 'bg-brand/10 text-brand-soft border-brand/25', mute: 'bg-white/5 text-slate-300 border-white/10' };
export const Badge = ({ tone = 'mute', children }) => <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>;

export function Delta({ value, invert = false }) {
  if (value == null) return <span className="text-xs text-slate-500">no prior data</span>;
  const good = invert ? value <= 0 : value >= 0;
  return <span className={cn('inline-flex items-center gap-1 text-xs font-medium', good ? 'text-gain' : 'text-loss')}>{value >= 0 ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%<span className="text-slate-500"> vs last month</span></span>;
}

export function Empty({ title, hint, action }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease }} className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-brand-soft"><Inbox size={28} /></div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {hint && <p className="max-w-xs text-sm text-slate-400">{hint}</p>}
      {action}
    </motion.div>
  );
}

export function Button({ loading, children, variant = 'primary', className, ...p }) {
  return <button className={cn(`btn-${variant}`, className)} disabled={loading || p.disabled} {...p}>{loading && <LoaderCircle size={16} className="animate-spin" />}{children}</button>;
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-800/95 p-6 shadow-2xl backdrop-blur-xl sm:max-w-md sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <button aria-label="Close" onClick={onClose} className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Group = ({ label, error, children }) => (
  <div role="group" aria-label={label}>
    <span className="label">{label}</span>
    {children}
    {error && <span role="alert" className="mt-1 block text-xs text-loss">{error}</span>}
  </div>
);
export const Field = ({ label, error, children }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
    {error && <span role="alert" className="mt-1 block text-xs text-loss">{error}</span>}
  </label>
);

// ---- Toasts
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((kind, msg) => {
    const id = Math.random();
    setList((l) => [...l, { id, kind, msg }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3600);
  }, []);
  const api = { success: (m) => push('ok', m), error: (m) => push('err', m) };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-24 right-4 z-[60] flex flex-col gap-2 lg:bottom-6" aria-live="polite">
        <AnimatePresence>
          {list.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={{ ease, duration: 0.35 }}
              className={cn('pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-xl', t.kind === 'ok' ? 'border-gain/30 bg-ink-800/95 text-gain' : 'border-loss/30 bg-ink-800/95 text-loss')}>
              {t.kind === 'ok' ? <CircleCheck size={16} /> : <TriangleAlert size={16} />}{t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ---- Config-driven form modal. fields: [{name,label,type,options,step,placeholder,hidden}] or (values)=>fields
export function FormModal({ open, onClose, title, fields, initial = {}, submitLabel = 'Save', onSubmit, footer }) {
  const [v, setV] = useState(initial), [busy, setBusy] = useState(false), [err, setErr] = useState({});
  const toast = useToast();
  useEffect(() => { if (open) { setV(initial); setErr({}); } }, [open]); // eslint-disable-line
  const list = typeof fields === 'function' ? fields(v) : fields;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try {
      await onSubmit(Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x != null)));
      onClose();
    } catch (ex) {
      const d = ex.response?.data?.error;
      setErr(d?.fields || {});
      toast.error(d?.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {list.filter((f) => !f.hidden).map((f, i) => {
          const common = { name: f.name, value: v[f.name] ?? '', onChange: (e) => setV((s) => ({ ...s, [f.name]: e.target.value })), className: 'input', 'aria-invalid': !!err[f.name] };
          return (
            <Group key={f.name} label={f.label} error={err[f.name]}>
              {f.type === 'select' ? (
                <Select value={v[f.name] ?? ''} onChange={(val) => setV((s) => ({ ...s, [f.name]: val }))} options={f.options || []} label={f.label} error={err[f.name]} placeholder={f.placeholder} />
              ) : f.type === 'date' ? (
                <DatePicker value={v[f.name] ?? ''} onChange={(val) => setV((s) => ({ ...s, [f.name]: val }))} label={f.label} clearable={f.clearable} min={f.min} max={f.max} placeholder={f.placeholder} />
              ) : f.type === 'month' ? (
                <MonthPicker value={v[f.name] ?? ''} onChange={(val) => setV((s) => ({ ...s, [f.name]: val }))} label={f.label} />
              ) : f.type === 'segment' ? (
                <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-ink-950/60 p-1">
                  {f.options.map((o) => (
                    <button type="button" key={o} onClick={() => setV((s) => ({ ...s, [f.name]: o }))} className={cn('cursor-pointer rounded-lg px-2 py-2 text-xs font-medium transition', v[f.name] === o ? 'bg-brand text-white shadow-glow' : 'text-slate-400 hover:text-white')}>{o}</button>
                  ))}
                </div>
              ) : (
                <input {...common} aria-label={f.label} type={f.type || 'text'} step={f.step || (f.type === 'number' ? 'any' : undefined)} placeholder={f.placeholder} autoFocus={i === 0 && !('ontouchstart' in window)} inputMode={f.type === 'number' ? 'decimal' : undefined} />
              )}
            </Group>
          );
        })}
        {footer?.(v)}
        <Button type="submit" loading={busy} className="w-full">{submitLabel}</Button>
      </form>
    </Modal>
  );
}
