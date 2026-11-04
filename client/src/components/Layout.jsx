import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ArrowLeftRight, Wallet, Repeat, PiggyBank, TrendingUp, Target, Settings as Cog, Plus, LogOut, X, Receipt, Landmark, Banknote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn, ease } from './ui';
import QuickAdd from './QuickAdd';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Settings', icon: Cog },
];
const mobile = [nav[0], nav[1], nav[5], nav[6], nav[7]];

export default function Layout() {
  const { user, logout } = useAuth();
  const [fab, setFab] = useState(false);
  const [quick, setQuick] = useState(null);
  const go = useNavigate();
  const items = [
    { k: 'Expense', icon: Receipt, c: 'text-loss' }, { k: 'Income', icon: Banknote, c: 'text-gain' },
    { k: 'Transfer', icon: ArrowLeftRight, c: 'text-brand-soft' }, { k: 'Goal', icon: Target, c: 'text-warn' },
  ];
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.07] bg-ink-950/50 p-4 backdrop-blur-2xl lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2 pt-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-brand to-gain shadow-glow"><Landmark size={20} className="text-white" /></div>
          <div><p className="text-lg font-bold leading-none text-white">FinTrack</p><p className="mt-1 text-[11px] text-slate-500">Your money, in one place</p></div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors', isActive ? 'text-white' : 'text-slate-400 hover:text-white')}>
              {({ isActive }) => (<>
                {isActive && <motion.span layoutId="pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} className="absolute inset-0 rounded-xl border border-brand/30 bg-linear-to-r from-brand/20 to-transparent" />}
                <n.icon size={18} className="relative" /><span className="relative">{n.label}</span>
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-linear-to-br from-brand to-indigo-500 text-sm font-bold text-white">{user.name[0]}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
          <button aria-label="Sign out" onClick={logout} className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-loss"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="mx-auto max-w-[1400px] px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8"><Outlet /></main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-ink-950/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
        {mobile.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors', isActive ? 'text-brand-soft' : 'text-slate-500')}>
            <n.icon size={20} />{n.label === 'Transactions' ? 'Money' : n.label}
          </NavLink>
        ))}
      </nav>

      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8">
        <AnimatePresence>
          {fab && items.map((it, i) => (
            <motion.button key={it.k} initial={{ opacity: 0, y: 16, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.8 }} transition={{ delay: (items.length - i) * 0.04, ease, duration: 0.3 }}
              onClick={() => { setFab(false); setQuick(it.k); }} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-ink-800/95 py-2 pl-4 pr-3 text-sm font-medium text-white shadow-xl backdrop-blur-xl">
              {it.k}<span className={cn('grid h-8 w-8 place-items-center rounded-full bg-white/10', it.c)}><it.icon size={16} /></span>
            </motion.button>
          ))}
        </AnimatePresence>
        <motion.button aria-label="Quick add" aria-expanded={fab} whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.06 }} onClick={() => setFab((f) => !f)}
          className="grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-linear-to-br from-brand to-brand-deep text-white shadow-glow">
          <motion.span animate={{ rotate: fab ? 135 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}><Plus size={26} /></motion.span>
        </motion.button>
      </div>
      <QuickAdd kind={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
