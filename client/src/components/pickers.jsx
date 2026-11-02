import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const cn = (...a) => a.filter(Boolean).join(' ');
const ease = [0.16, 1, 0.3, 1];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseISO = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return { y, m: m - 1, d: d || 1 }; };
const fmtDate = (s) => { const p = parseISO(s); return p ? `${pad(p.d)} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : ''; };

// Portal popover: positioned from the anchor, flips upward near the bottom, closes on outside click / Esc / scroll.
function Popover({ anchor, open, onClose, minW = 0, children }) {
  const pop = useRef(null);
  const [pos, setPos] = useState({ left: 0, w: 0, up: false, top: 0, bottom: 0, maxH: 320 });
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current.getBoundingClientRect();
      const w = Math.max(r.width, minW);
      const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
      const up = below < 300 && above > below;
      setPos({ w, up, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: r.bottom + 6, bottom: window.innerHeight - r.top + 6, maxH: Math.max(180, Math.min(380, up ? above : below)) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const t0 = Date.now();
    const down = (e) => { if (!pop.current?.contains(e.target) && !anchor.current?.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const scroll = (e) => { if (Date.now() - t0 > 250 && !pop.current?.contains(e.target)) onClose(); };
    document.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key, true);
    window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key, true); window.removeEventListener('scroll', scroll, true); };
  }, [open]); // eslint-disable-line
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div ref={pop} initial={{ opacity: 0, y: pos.up ? 8 : -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18, ease }}
          style={{ position: 'fixed', left: pos.left, width: pos.w, maxHeight: pos.maxH, zIndex: 80, ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }) }}
          className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-800/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,.7)] backdrop-blur-2xl">
          {children}
        </motion.div>
      )}
    </AnimatePresence>, document.body);
}

const triggerCls = 'input flex cursor-pointer items-center justify-between gap-2 text-left';

// ---------------- Select (custom listbox)
export function Select({ value, onChange, options = [], placeholder = 'Select…', label, error, searchable, className }) {
  const norm = useMemo(() => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)), [options]);
  const [open, setOpen] = useState(false), [q, setQ] = useState(''), [hi, setHi] = useState(0);
  const anchor = useRef(null), btn = useRef(null), list = useRef(null), box = useRef(null);
  const shown = norm.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const sel = norm.find((o) => String(o.value) === String(value));
  const showSearch = searchable ?? norm.length > 8;
  const show = () => { setQ(''); setHi(Math.max(0, norm.findIndex((o) => String(o.value) === String(value)))); setOpen(true); };
  const close = () => { setOpen(false); btn.current?.focus(); };
  const pick = (o) => { onChange(o.value); close(); };
  useEffect(() => { if (open) setTimeout(() => (box.current?.querySelector('input') || box.current)?.focus({ preventScroll: true }), 30); }, [open]);
  useEffect(() => { if (open) list.current?.children[hi]?.scrollIntoView({ block: 'nearest' }); }, [hi, open]);
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Home') setHi(0);
    else if (e.key === 'End') setHi(shown.length - 1);
    else if (e.key === 'Enter') { e.preventDefault(); shown[hi] && pick(shown[hi]); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return (
    <div ref={anchor} className={className}>
      <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label} aria-invalid={!!error}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={(e) => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); show(); } }} className={triggerCls}>
        <span className={cn('truncate', !sel && 'text-slate-500')}>{sel ? sel.label : placeholder}</span>
        <ChevronDown size={16} className={cn('shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)}>
        <div ref={box} tabIndex={-1} onKeyDown={onKey} className="flex min-h-0 flex-col outline-none">
          {showSearch && (
            <div className="relative border-b border-white/[0.07] p-2">
              <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} placeholder="Search…" aria-label="Search options" className="w-full rounded-lg bg-ink-950/60 py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-brand/50" />
            </div>)}
          <ul ref={list} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">No options</li>}
            {shown.map((o, i) => {
              const on = String(o.value) === String(value);
              return (
                <li key={o.value} role="option" aria-selected={on} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}
                  className={cn('flex min-h-[40px] cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-sm transition-colors', i === hi ? 'bg-brand/20 text-white' : 'text-slate-300', on && 'font-medium text-white')}>
                  <span className="truncate">{o.label}</span>{on && <Check size={15} className="shrink-0 text-brand-soft" />}
                </li>);
            })}
          </ul>
        </div>
      </Popover>
    </div>
  );
}

// ---------------- DatePicker (calendar)
export function DatePicker({ value, onChange, placeholder = 'Pick a date', min, max, clearable, label, className }) {
  const now = new Date(), today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const sel = parseISO(value);
  const [open, setOpen] = useState(false), [mode, setMode] = useState('days'), [dir, setDir] = useState(0);
  const [view, setView] = useState({ y: (sel || today).y, m: (sel || today).m });
  const anchor = useRef(null), btn = useRef(null);
  const show = () => { const b = sel || today; setView({ y: b.y, m: b.m }); setMode('days'); setOpen(true); };
  const go = (n) => { setDir(n); setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); };
  const first = new Date(view.y, view.m, 1).getDay(), count = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const off = (iso) => (min && iso < min) || (max && iso > max);
  const choose = (iso) => { onChange(iso); setOpen(false); btn.current?.focus(); };
  const nav = 'grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white';
  const todayISO = toISO(today.y, today.m, today.d);
  return (
    <div ref={anchor} className={className}>
      <button ref={btn} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={label ? `${label}: ${fmtDate(value) || 'not set'}` : placeholder} onClick={() => (open ? setOpen(false) : show())} className={triggerCls}>
        <span className={cn('truncate', !value && 'text-slate-500')}>{value ? fmtDate(value) : placeholder}</span>
        <Calendar size={16} className="shrink-0 text-slate-400" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} minW={296}>
        <div className="p-3" role="dialog" aria-label="Calendar">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label={mode === 'days' ? 'Previous month' : 'Previous year'} className={nav} onClick={() => (mode === 'days' ? go(-1) : setView((v) => ({ ...v, y: v.y - 1 })))}><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => setMode((m) => (m === 'days' ? 'months' : 'days'))} className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10">{mode === 'days' ? `${MONTHS[view.m]} ${view.y}` : view.y}</button>
            <button type="button" aria-label={mode === 'days' ? 'Next month' : 'Next year'} className={nav} onClick={() => (mode === 'days' ? go(1) : setView((v) => ({ ...v, y: v.y + 1 })))}><ChevronRight size={18} /></button>
          </div>
          {mode === 'months' ? (
            <div className="grid grid-cols-3 gap-1.5">{MONTHS.map((m, i) => (
              <button type="button" key={m} onClick={() => { setView((v) => ({ ...v, m: i })); setMode('days'); }} className={cn('min-h-[44px] cursor-pointer rounded-xl text-sm transition', i === view.m ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/10')}>{m.slice(0, 3)}</button>))}</div>
          ) : (<>
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="py-1">{d}</span>)}</div>
            <motion.div key={`${view.y}-${view.m}`} initial={{ opacity: 0, x: dir * 22 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease }} className="grid grid-cols-7 gap-y-1">
              {cells.map((d, i) => {
                if (!d) return <span key={i} />;
                const iso = toISO(view.y, view.m, d), isSel = value && iso === String(value).slice(0, 10), isToday = iso === todayISO, dis = off(iso);
                return (
                  <button type="button" key={i} disabled={dis} onClick={() => choose(iso)} aria-label={fmtDate(iso)} aria-pressed={!!isSel}
                    className={cn('mx-auto grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-sm tabular-nums transition duration-150 disabled:cursor-not-allowed disabled:opacity-25',
                      isSel ? 'bg-linear-to-b from-brand to-brand-deep font-semibold text-white shadow-glow' : 'text-slate-200 hover:bg-white/10', isToday && !isSel && 'ring-1 ring-brand/60 text-brand-soft')}>{d}</button>);
              })}
            </motion.div>
          </>)}
          <div className="mt-2 flex items-center justify-between border-t border-white/[0.07] pt-2">
            <button type="button" disabled={off(todayISO)} onClick={() => choose(todayISO)} className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-brand-soft transition hover:bg-brand/10 disabled:opacity-30">Today</button>
            {clearable && value && <button type="button" onClick={() => choose('')} className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/10 hover:text-white">Clear</button>}
          </div>
        </div>
      </Popover>
    </div>
  );
}

// ---------------- MonthPicker ('YYYY-MM')
export function MonthPicker({ value, onChange, max, label = 'Month', className }) {
  const cur = value ? { y: +value.slice(0, 4), m: +value.slice(5, 7) - 1 } : { y: new Date().getFullYear(), m: new Date().getMonth() };
  const [open, setOpen] = useState(false), [year, setYear] = useState(cur.y);
  const anchor = useRef(null), btn = useRef(null);
  const key = (y, m) => `${y}-${pad(m + 1)}`;
  return (
    <div ref={anchor} className={className}>
      <button ref={btn} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${MONTHS[cur.m]} ${cur.y}`} onClick={() => { setYear(cur.y); setOpen((o) => !o); }} className={triggerCls}>
        <span>{MONTHS[cur.m]} {cur.y}</span><Calendar size={16} className="shrink-0 text-slate-400" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} minW={272}>
        <div className="p-3" role="dialog" aria-label="Choose month">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous year" className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-slate-300 hover:bg-white/10" onClick={() => setYear((y) => y - 1)}><ChevronLeft size={18} /></button>
            <span className="text-sm font-semibold text-white">{year}</span>
            <button type="button" aria-label="Next year" disabled={max && key(year + 1, 0) > max} className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-slate-300 hover:bg-white/10 disabled:opacity-25" onClick={() => setYear((y) => y + 1)}><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">{MONTHS.map((m, i) => {
            const k = key(year, i), on = k === value, dis = max && k > max;
            return <button type="button" key={m} disabled={dis} onClick={() => { onChange(k); setOpen(false); btn.current?.focus(); }}
              className={cn('min-h-[44px] cursor-pointer rounded-xl text-sm transition disabled:cursor-not-allowed disabled:opacity-25', on ? 'bg-linear-to-b from-brand to-brand-deep font-semibold text-white shadow-glow' : 'text-slate-300 hover:bg-white/10')}>{m.slice(0, 3)}</button>;
          })}</div>
        </div>
      </Popover>
    </div>
  );
}
