'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  Home, Trophy, User, Settings, Shield, LogOut, Menu, X, Award, History, Users, Newspaper, Sparkles,
  MessageCircle, Swords, Medal, ChevronDown, PanelLeftClose, PanelLeftOpen, ShoppingBag, Coins, Ticket, Radar, Search,
} from 'lucide-react';
import { getTier } from '../lib/tiers';

type UserInfo = { accountId?: number; elo?: number; staffLevel?: string | null; copsName?: string };
type Item = { href: string; label: string; icon: any; badge?: number; dot?: boolean };

const COLLAPSE_KEY = 'exq_sidebar_collapsed';
const GROUPS_KEY = 'exq_sidebar_groups';

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop hide
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [dmUnread, setDmUnread] = useState(0);
  const [ep, setEp] = useState<number | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  const [newUpdates, setNewUpdates] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        setNewUpdates(Number(localStorage.getItem('exq_updates_latest') || 0) > Number(localStorage.getItem('exq_updates_seen') || 0));
      } catch {
        /* ignore */
      }
    };
    check();
    window.addEventListener('exq-updates', check);
    return () => window.removeEventListener('exq-updates', check);
  }, []);

  // Restore persisted UI state
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
      const g = localStorage.getItem(GROUPS_KEY);
      if (g) setOpenGroups(JSON.parse(g));
    } catch {
      /* ignore */
    }
  }, []);

  // Reflect collapse on <html> so the content area can widen (see globals.css)
  useEffect(() => {
    try {
      document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!session) { setInfo(null); setEp(null); return; }
    fetch('/api/user').then(r => (r.ok ? r.json() : null)).then(d => setInfo(d)).catch(() => {});
    fetch('/api/economy').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setEp(d.balance ?? 0); }).catch(() => {});
  }, [session, pathname]);

  // Poll unread DM + group count for the badge
  useEffect(() => {
    if (!session) { setDmUnread(0); return; }
    let alive = true;
    const load = () =>
      Promise.all([
        fetch('/api/dm?count=1').then(r => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/groups?count=1').then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]).then(([dm, gr]) => { if (alive) setDmUnread((dm?.unread || 0) + (gr?.unread || 0)); });
    load();
    const id = setInterval(load, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [session]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    fetch('/api/flags').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setFlags(d.flags); }).catch(() => {});
  }, [pathname]);

  // Presence heartbeat while the app is open
  useEffect(() => {
    if (!session) return;
    const ping = () => { fetch('/api/presence', { method: 'POST' }).catch(() => {}); };
    ping();
    const iv = setInterval(ping, 45000);
    return () => clearInterval(iv);
  }, [session]);

  const accountId = info?.accountId;
  const elo = info?.elo;
  const staff = info?.staffLevel === 'admin' || info?.staffLevel === 'mod';
  const tier = typeof elo === 'number' ? getTier(elo) : null;

  const ff = (k: string) => !flags || flags[k] !== false;

  const topItems: Item[] = [
    { href: '/', label: 'Hub', icon: Home },
    { href: '/search', label: 'Search', icon: Search },
    ...(accountId != null ? [{ href: `/profile/${accountId}`, label: 'Profile', icon: User }] : []),
    ...(ff('shop') ? [{ href: '/shop', label: 'Shop', icon: ShoppingBag }] : []),
  ];
  const competeItems: Item[] = [
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/matches', label: 'Matches', icon: History },
    ...(ff('tournaments') ? [{ href: '/tournaments', label: 'Tournaments', icon: Medal }] : []),
    ...(ff('battlepass') ? [{ href: '/battlepass', label: 'Battle Pass', icon: Ticket }] : []),
    { href: '/season', label: 'Season', icon: Award },
  ];
  const socialItems: Item[] = [
    ...(ff('feed') ? [{ href: '/feed', label: 'Feed', icon: Newspaper }] : []),
    { href: '/friends', label: 'Friends', icon: Users },
    { href: '/lfg', label: 'LFG', icon: Radar },
    ...(ff('messages') ? [{ href: '/messages', label: 'Messages', icon: MessageCircle, badge: dmUnread }] : []),
    ...(ff('clubs') ? [{ href: '/clans', label: 'Clubs', icon: Swords }] : []),
    { href: '/updates', label: "What's New", icon: Sparkles, dot: true },
  ];
  const bottomItems: Item[] = [
    { href: '/settings', label: 'Settings', icon: Settings },
    ...(staff ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || (href.startsWith('/profile') && pathname.startsWith('/profile'));

  const groupOpen = (label: string) => openGroups[label] !== false; // default open
  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [label]: !groupOpen(label) };
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const renderLink = (l: Item) => {
    const Icon = l.icon;
    const active = isActive(l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
          active ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <Icon size={18} /> {l.label}
        {l.dot && newUpdates && <span className="ml-1 h-2 w-2 rounded-full bg-red-500" />}
        {(l.badge ?? 0) > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1.5 text-[11px] font-black text-black">
            {(l.badge as number) > 99 ? '99+' : l.badge}
          </span>
        )}
      </Link>
    );
  };

  const renderGroup = (label: string, items: Item[]) => {
    const isOpen = groupOpen(label);
    const groupBadge = items.reduce((s, it) => s + (it.badge || 0), 0);
    return (
      <div key={label} className="pt-1">
        <button
          onClick={() => toggleGroup(label)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600 transition-colors hover:text-gray-300"
        >
          <span>{label}</span>
          {!isOpen && groupBadge > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-black text-black">
              {groupBadge > 99 ? '99+' : groupBadge}
            </span>
          )}
          <ChevronDown size={13} className={`ml-auto transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        </button>
        {isOpen && <div className="mt-0.5 space-y-0.5">{items.map(renderLink)}</div>}
      </div>
    );
  };

  const content = (desktop: boolean) => (
    <>
      <div className="mb-6 flex items-center justify-between px-2">
        <Link href="/">
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-lg font-black italic tracking-tighter text-transparent">
            EXQUISITE COPS
          </span>
        </Link>
        {desktop && (
          <button onClick={() => setCollapsed(true)} title="Hide sidebar" className="text-gray-500 transition-colors hover:text-white">
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {topItems.map(renderLink)}
        {renderGroup('Compete', competeItems)}
        {renderGroup('Social', socialItems)}
        <div className="my-2 border-t border-white/5" />
        {bottomItems.map(renderLink)}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        {session ? (
          <div className="flex items-center gap-3 px-1">
            <Link href={accountId != null ? `/profile/${accountId}` : '#'} className="block h-10 w-10 shrink-0 overflow-hidden rounded-full" style={{ boxShadow: `0 0 0 2px ${tier?.color ?? '#22d3ee'}` }}>
              {session.user?.image ? (
                <img src={session.user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-black text-white">
                  {(info?.copsName || session.user?.name || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{info?.copsName || session.user?.name}</p>
              {tier && <p className="truncate text-[11px] font-bold" style={{ color: tier.color }}>{elo} · {tier.name}</p>}
              {ep != null && (
                <Link href="/shop" className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200">
                  <Coins size={11} /> {ep.toLocaleString()} EP
                </Link>
              )}
            </div>
            <button onClick={() => signOut()} title="Logout" className="text-gray-500 transition-colors hover:text-red-400">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button onClick={() => signIn('discord', { callbackUrl: '/' })} className="w-full rounded-full bg-white px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-cyan-400">
            Connect
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          .app-content { padding-left: 15rem; transition: padding-left 0.2s ease; }
          html[data-sidebar='collapsed'] .app-content { padding-left: 0; }
        }
      `}</style>

      {/* Desktop: fixed left sidebar */}
      <aside className={`fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-white/10 bg-[#0a0a0e] p-4 transition-transform duration-200 md:flex ${collapsed ? '-translate-x-full' : 'translate-x-0'}`}>
        {content(true)}
      </aside>

      {/* Desktop: floating re-open button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Show sidebar"
          className="fixed left-3 top-3 z-40 hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0c0c12]/90 text-gray-300 backdrop-blur transition-colors hover:border-white/25 hover:text-white md:flex"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      {/* Mobile: top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#0a0a0e] px-4 py-3 md:hidden">
        <Link href="/">
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-base font-black italic tracking-tighter text-transparent">
            EXQUISITE COPS
          </span>
        </Link>
        <button onClick={() => setOpen(true)} className="text-gray-300" aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile: drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-white/10 bg-[#0a0a0e] p-4">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 text-gray-500 hover:text-white" aria-label="Close menu">
              <X size={20} />
            </button>
            {content(false)}
          </aside>
        </div>
      )}
    </>
  );
}
