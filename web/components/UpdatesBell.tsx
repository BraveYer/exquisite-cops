'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';

type Update = { id: string; title: string; body: string; version: string; createdAt: string | null };

export default function UpdatesBell() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [latest, setLatest] = useState(0);
  const [seen, setSeen] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch('/api/updates')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUpdates(d.updates || []);
        setLatest(d.latest || 0);
        try {
          localStorage.setItem('exq_updates_latest', String(d.latest || 0));
          window.dispatchEvent(new Event('exq-updates'));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});

  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem('exq_updates_seen') || 0));
    } catch {
      /* ignore */
    }
    load();
    const iv = setInterval(load, 90000);
    const onEvt = () => {
      try {
        setSeen(Number(localStorage.getItem('exq_updates_seen') || 0));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('exq-updates', onEvt);
    return () => {
      clearInterval(iv);
      window.removeEventListener('exq-updates', onEvt);
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const hasNew = latest > seen;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && hasNew) {
      try {
        localStorage.setItem('exq_updates_seen', String(latest));
        window.dispatchEvent(new Event('exq-updates'));
      } catch {
        /* ignore */
      }
      setSeen(latest);
    }
  };

  return (
    <div ref={ref} className="fixed right-28 top-3 z-[60] md:right-16">
      <button onClick={toggle} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-colors hover:text-white" title="What's New">
        <Sparkles size={18} />
        {hasNew && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#070709]" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12]/[0.98] shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-black text-white"><Sparkles size={15} className="text-cyan-400" /> What&apos;s New</span>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={15} /></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {updates.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-600">No updates yet.</p>
            ) : (
              updates.slice(0, 6).map((u) => (
                <div key={u.id} className="border-b border-white/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-white">{u.title}</p>
                    {u.version && <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">{u.version}</span>}
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-gray-400">{u.body}</p>
                </div>
              ))
            )}
          </div>
          <Link href="/updates" onClick={() => setOpen(false)} className="block border-t border-white/10 px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-cyan-400 hover:bg-white/5">
            See all updates
          </Link>
        </div>
      )}
    </div>
  );
}
