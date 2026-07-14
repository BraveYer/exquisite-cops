'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bell, UserPlus, Users, Check, X } from 'lucide-react';

type Item = { id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

function iconFor(type: string) {
  if (type === 'friend_request' || type === 'friend_accept') return UserPlus;
  if (type === 'party_invite') return Users;
  return Bell;
}

function timeAgo(s?: string) {
  if (!s) return '';
  const t = new Date(s).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  const requestNotif = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      const its: Item[] = d.items || [];
      setItems(its);
      setUnread(d.unread || 0);

      // Desktop notification for items that arrived since the last poll.
      if (primed.current && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        its.filter((it) => !it.read && !seen.current.has(it.id)).slice(0, 3).forEach((it) => {
          try {
            const n = new Notification(it.title || 'Exquisite COPS', { body: it.body || '', tag: it.id });
            n.onclick = () => {
              window.focus();
              if (it.link) window.location.href = it.link;
            };
          } catch {
            /* ignore */
          }
        });
      }
      its.forEach((it) => seen.current.add(it.id));
      primed.current = true;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setItems([]);
      setUnread(0);
      return;
    }
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [session, load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markAll = async () => {
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'readAll' }) }).catch(() => {});
  };

  const openItem = async (it: Item) => {
    setOpen(false);
    const isStored = /^[a-f0-9]{24}$/i.test(it.id); // real notification (ObjectId) vs derived state item
    if (isStored && !it.read) {
      fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', id: it.id }) }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    if (it.link) router.push(it.link);
  };

  if (!session) return null;

  return (
    <div ref={ref} className="fixed right-14 top-[3px] z-[60] md:right-5 md:top-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0c0c12]/90 text-gray-300 backdrop-blur transition-colors hover:border-white/25 hover:text-white"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-14 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0f]/[0.98] shadow-2xl backdrop-blur md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-80">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-black text-white">Notifications</p>
            {items.some((i) => !i.read) ? (
              <button onClick={markAll} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-cyan-400">
                <Check size={12} /> Mark all
              </button>
            ) : null}
          </div>
          {notifPerm === 'default' && (
            <button onClick={requestNotif} className="flex w-full items-center gap-2 border-b border-white/10 bg-cyan-500/[0.06] px-4 py-2.5 text-left text-xs font-bold text-cyan-300 hover:bg-cyan-500/10">
              <Bell size={13} /> Enable desktop notifications
            </button>
          )}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm font-bold uppercase tracking-widest text-gray-600">No notifications</p>
            ) : (
              items.map((it) => {
                const Icon = iconFor(it.type);
                return (
                  <button
                    key={it.id}
                    onClick={() => openItem(it)}
                    className={`flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${it.read ? 'opacity-60' : ''}`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.read ? 'bg-white/5 text-gray-500' : 'bg-cyan-500/15 text-cyan-300'}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">{it.title}</p>
                      {it.body ? <p className="truncate text-xs text-gray-400">{it.body}</p> : null}
                      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-600">{timeAgo(it.createdAt)}</p>
                    </div>
                    {!it.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
