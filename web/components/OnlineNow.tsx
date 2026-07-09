'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio } from 'lucide-react';
import TierBadge from './TierBadge';

type P = { copsName: string; accountId: number | null; elo: number; avatar: string | null };

export default function OnlineNow() {
  const [players, setPlayers] = useState<P[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/online')
        .then(r => (r.ok ? r.json() : { players: [] }))
        .then(d => { if (alive) { setPlayers(d.players || []); setLoaded(true); } })
        .catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!loaded) return null;

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
        <Radio size={16} className="text-emerald-400" /> Searching now
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">{players.length}</span>
      </div>

      {players.length === 0 ? (
        <p className="py-4 text-center text-sm font-bold uppercase tracking-widest text-gray-600">
          No one's in queue right now.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {players.map((p, i) => {
            const inner = (
              <>
                <span className="flex items-center gap-3 min-w-0">
                  <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-black text-white">
                        {(p.copsName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="truncate font-bold text-white">{p.copsName}</span>
                </span>
                <TierBadge elo={p.elo} px={24} />
              </>
            );
            return p.accountId != null ? (
              <Link
                key={i}
                href={`/profile/${p.accountId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.06]"
              >
                {inner}
              </Link>
            ) : (
              <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
