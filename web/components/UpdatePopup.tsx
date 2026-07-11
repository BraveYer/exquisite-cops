'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';

type Update = { id: string; title: string; body: string; version: string; createdAt: string | null };

export default function UpdatePopup() {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    // Don't stack on top of the first-visit welcome modal.
    try {
      if (!localStorage.getItem('exq_onboarded_v1')) return;
    } catch {
      /* ignore */
    }
    fetch('/api/updates')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.updates?.length) return;
        const latestTs = d.latest || 0;
        let seen = 0;
        try {
          seen = Number(localStorage.getItem('exq_update_popup') || 0);
        } catch {
          /* ignore */
        }
        if (latestTs > seen) setUpdate(d.updates[0]);
      })
      .catch(() => {});
  }, []);

  const close = () => {
    try {
      const ts = update?.createdAt ? new Date(update.createdAt).getTime() : Date.now();
      localStorage.setItem('exq_update_popup', String(ts));
    } catch {
      /* ignore */
    }
    setUpdate(null);
  };

  if (!update) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c12]">
        <button onClick={close} className="absolute right-4 top-4 z-10 text-gray-500 hover:text-white"><X size={18} /></button>
        <div className="border-b border-white/5 bg-gradient-to-br from-cyan-500/[0.12] to-transparent px-8 py-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15">
            <Sparkles size={26} className="text-cyan-400" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400">What&apos;s New</p>
          <h2 className="mt-1 text-2xl font-black text-white">{update.title}</h2>
          {update.version && <span className="mt-2 inline-block rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">{update.version}</span>}
        </div>
        <div className="max-h-[40vh] overflow-y-auto px-8 py-5">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{update.body}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-6 py-4">
          <Link href="/updates" onClick={close} className="text-sm font-bold text-gray-400 hover:text-white">See all updates</Link>
          <button onClick={close} className="rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-black uppercase tracking-widest text-black hover:bg-cyan-400">Got it</button>
        </div>
      </div>
    </div>
  );
}
