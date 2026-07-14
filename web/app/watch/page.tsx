'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, Swords, Map as MapIcon, Loader2, Eye } from 'lucide-react';
import PageBackground from '../../components/PageBackground';

type LiveMatch = { matchId: string; map: string | null; status: string; teamA: string[]; teamB: string[]; size: number; startedAt: string | null };

const STATUS_LABEL: Record<string, string> = { drafting: 'Drafting', veto: 'Map veto', ongoing: 'Live', pending_review: 'Reporting' };

export default function WatchPage() {
  const [matches, setMatches] = useState<LiveMatch[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch('/api/matches/live', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && active) setMatches(d.matches || []); })
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { active = false; clearInterval(t); };
  }, []);

  return (
    <div className="relative min-h-screen">
      <PageBackground />
      <div className="relative mx-auto max-w-3xl px-4 py-10 md:py-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.3em] text-red-400">Spectate</div>
            <h1 className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent">Exquisite Pro League</h1>
          </div>
        </div>

        {!matches ? (
          <div className="flex justify-center py-20 text-cyan-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : matches.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-20 text-center">
            <Radio size={30} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm font-bold uppercase tracking-widest text-gray-500">No Pro League matches live right now</p>
            <p className="mt-2 text-xs text-gray-600">Only official Exquisite Pro League matches are broadcast here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <Link
                key={m.matchId}
                href={`/match/${m.matchId}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-cyan-500/40 hover:bg-white/[0.05]"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${m.status === 'ongoing' ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-gray-400'}`}>
                    {m.status === 'ongoing' && <Radio size={10} />} {STATUS_LABEL[m.status] || m.status}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                    {m.map ? (<><MapIcon size={12} /> {m.map}</>) : null}
                    <span className="ml-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px]">{Math.round(m.size / 2)}v{Math.round(m.size / 2)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 text-right">
                    {m.teamA.map((n, i) => <p key={i} className="truncate text-sm font-bold text-cyan-300">{n}</p>)}
                  </div>
                  <div className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs font-black text-gray-500">VS</div>
                  <div className="min-w-0 flex-1">
                    {m.teamB.map((n, i) => <p key={i} className="truncate text-sm font-bold text-fuchsia-300">{n}</p>)}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500">
                  <Eye size={12} /> Watch
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
