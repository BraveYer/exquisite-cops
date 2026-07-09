'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Swords, Loader2, MapPin } from 'lucide-react';
import PageBackground from '../../components/PageBackground';

type Player = { copsName: string; accountId: number | null; elo: number; avatar: string | null };
type Match = {
  matchId: string;
  map: string;
  winner: 'A' | 'B' | null;
  completedAt: string | null;
  teamA: Player[];
  teamB: Player[];
};

function timeAgo(s?: string | null) {
  if (!s) return '';
  const d = new Date(s).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function TeamLine({ team, won, align }: { team: Player[]; won: boolean; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      {team.length === 0 ? (
        <span className="text-sm text-gray-600">—</span>
      ) : (
        team.map((p, i) => (
          <span
            key={i}
            className={`truncate text-sm font-bold ${won ? 'text-white' : 'text-gray-500'}`}
          >
            {p.copsName}
          </span>
        ))
      )}
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/matches')
      .then(r => (r.ok ? r.json() : { matches: [] }))
      .then(d => { setMatches(d.matches || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-cyan-500/40">
      <PageBackground />

      <div className="relative mx-auto max-w-3xl px-6 py-10 md:py-16">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 font-bold text-gray-400 transition-colors hover:text-cyan-400">
          <ArrowLeft size={20} /> BACK TO HUB
        </Link>

        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">The feed</p>
        <h1 className="mb-2 text-4xl font-black tracking-tighter md:text-5xl">
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">Recent matches</span>
        </h1>
        <p className="mb-8 text-sm font-bold uppercase tracking-widest text-gray-500">Latest completed games on the hub</p>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-24 text-cyan-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-bold uppercase tracking-widest">Loading…</p>
          </div>
        ) : matches.length === 0 ? (
          <p className="py-24 text-center font-bold uppercase tracking-widest text-gray-600">No matches played yet.</p>
        ) : (
          <div className="space-y-3">
            {matches.map(m => {
              const aWon = m.winner === 'A';
              const bWon = m.winner === 'B';
              const body = (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                      <MapPin size={13} className="text-cyan-400" /> {m.map}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600">{timeAgo(m.completedAt)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TeamLine team={m.teamA} won={aWon} align="left" />
                    <div className="flex shrink-0 flex-col items-center">
                      <Swords size={16} className="text-gray-600" />
                      <span className="mt-1 text-[10px] font-black uppercase tracking-widest">
                        <span className={aWon ? 'text-emerald-400' : 'text-gray-600'}>A</span>
                        <span className="text-gray-700"> · </span>
                        <span className={bWon ? 'text-emerald-400' : 'text-gray-600'}>B</span>
                      </span>
                    </div>
                    <TeamLine team={m.teamB} won={bWon} align="right" />
                  </div>
                </>
              );
              return (
                <Link
                  key={m.matchId}
                  href={`/match/${m.matchId}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.06]"
                >
                  {body}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
