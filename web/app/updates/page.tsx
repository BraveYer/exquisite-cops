'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';

type Update = { id: string; title: string; body: string; version: string; byName: string; createdAt: string | null };

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/updates')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setUpdates(d.updates || []);
          try {
            localStorage.setItem('exq_updates_seen', String(d.latest || 0));
            window.dispatchEvent(new Event('exq-updates'));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <div className="mx-auto max-w-2xl px-6 py-10 md:py-14">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-white">
          <ArrowLeft size={16} /> Back to hub
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <Sparkles size={26} className="text-cyan-400" />
          <h1 className="text-3xl font-black tracking-tight">What&apos;s New</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-cyan-400"><Loader2 className="animate-spin" size={26} /></div>
        ) : updates.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-gray-500">No updates yet — check back soon.</p>
        ) : (
          <div className="relative space-y-6 border-l border-white/10 pl-6">
            {updates.map((u) => (
              <div key={u.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-[#070709] bg-cyan-400" />
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-white">{u.title}</h2>
                    {u.version && <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">{u.version}</span>}
                  </div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-600">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''} · {u.byName}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{u.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
